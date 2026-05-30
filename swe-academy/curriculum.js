// Curriculum content for SWE Academy.
// Each module = one card on the home roadmap.
// Each lesson = a sequence of "blocks" rendered by app.js.
//
// Block types:
//   { type: 'text',  html: '...' }                    -> rich text (HTML allowed)
//   { type: 'code',  lang: 'js', code: '...' }        -> read-only code sample
//   { type: 'play',  lang: 'js', starter: '...' }     -> interactive JS playground
//   { type: 'quiz',  q, options:[...], answer, why }  -> multiple-choice quiz
//   { type: 'callout', tone:'tip|warn', label, html } -> highlighted box
//   { type: 'diagram', svg: '...' }                   -> inline SVG diagram
//   { type: 'htmlplay', starter: '<html>...' }        -> HTML/CSS live preview
//   { type: 'sqlplay', schema:'...', seed:'...', starter:'...' } -> SQL playground (sql.js)
//   { type: 'challenge', challengeId: 'sum' }         -> auto-graded coding challenge
//   { type: 'terminal', initial:[], tasks:[...] }     -> simulated terminal (git/bash)
//   { type: 'flashcards', cardIds: ['fc-...'] }       -> inline flashcard stack
//   { type: 'jobbox', label?, title?, html }         -> "on the job" framing / portfolio nudge
//   { type: 'rubric', title?, rows: [[a,b], ...] }    -> interview / code-review lens table
//   { type: 'drill-fill', parts: [str, {blank}, ...] } -> fill-the-blank micro-drill
//   { type: 'drill-predict', q, options[], answer, why? } -> quick MC predict
//   { type: 'drill-reorder', intro?, lines[], correctOrder? } -> reorder steps (indices)

const CURRICULUM = [
  // ========================================================================
  // 1. FOUNDATION
  // ========================================================================
  {
    id: 'foundation',
    title: 'Foundation',
    icon: 'JS',
    color: 'var(--c-foundation)',
    desc: 'The bedrock: how the web works, JavaScript, APIs, databases, Git, Docker, and security basics.',
    lessons: [
      {
        id: 'how-web-works',
        title: 'How the Web Actually Works',
        desc: 'Before we touch any code, you need a mental model of what happens when you visit a website.',
        blocks: [
          { type: 'text', html: `
            <p>When you type <code>google.com</code> into your browser and hit enter, a <strong>conversation</strong> starts between two computers: your laptop (the <strong>client</strong>) and a remote computer somewhere in the world (the <strong>server</strong>).</p>
            <h3>The 5-step story</h3>
            <ol>
              <li><strong>DNS lookup</strong> — your browser asks "what IP address is google.com?" and gets back something like <code>142.250.80.46</code>.</li>
              <li><strong>TCP connection</strong> — your computer opens a phone line to that IP.</li>
              <li><strong>HTTP request</strong> — you say "please send me your homepage."</li>
              <li><strong>HTTP response</strong> — the server replies with HTML, CSS, JavaScript, images.</li>
              <li><strong>Render</strong> — your browser turns those files into the page you see.</li>
            </ol>
            <p>That entire round-trip happens in ~200 milliseconds. Every website works this way.</p>
          ` },
          { type: 'callout', tone: 'tip', label: 'Mental model', html: `Think of the internet as a giant restaurant. Your <em>client</em> orders food from a <em>menu</em> (URL). The <em>server</em> cooks (processes) and brings back food (HTML/data). HTTP is the language they speak.` },
          { type: 'diagram', svg: `
            <svg viewBox="0 0 600 200" xmlns="http://www.w3.org/2000/svg">
              <rect x="20" y="60" width="140" height="80" rx="10" fill="#1c1f2e" stroke="#7c5cff" stroke-width="2"/>
              <text x="90" y="95" text-anchor="middle" fill="#fff" font-family="Inter" font-size="14" font-weight="700">Browser</text>
              <text x="90" y="115" text-anchor="middle" fill="#9aa0b8" font-family="Inter" font-size="11">(Client)</text>
              <rect x="440" y="60" width="140" height="80" rx="10" fill="#1c1f2e" stroke="#5eead4" stroke-width="2"/>
              <text x="510" y="95" text-anchor="middle" fill="#fff" font-family="Inter" font-size="14" font-weight="700">Server</text>
              <text x="510" y="115" text-anchor="middle" fill="#9aa0b8" font-family="Inter" font-size="11">(Computer in cloud)</text>
              <line x1="160" y1="85" x2="440" y2="85" stroke="#a78bfa" stroke-width="2" marker-end="url(#a)"/>
              <line x1="440" y1="115" x2="160" y2="115" stroke="#5eead4" stroke-width="2" marker-end="url(#b)"/>
              <text x="300" y="78" text-anchor="middle" fill="#a78bfa" font-family="Inter" font-size="12">GET /</text>
              <text x="300" y="135" text-anchor="middle" fill="#5eead4" font-family="Inter" font-size="12">200 OK + HTML</text>
              <defs>
                <marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#a78bfa"/></marker>
                <marker id="b" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#5eead4"/></marker>
              </defs>
            </svg>
          ` },
          { type: 'text', html: `
            <h3>Three kinds of code, three jobs</h3>
            <ul>
              <li><strong>HTML</strong> — the structure (the bones). Headings, paragraphs, buttons.</li>
              <li><strong>CSS</strong> — the look (the skin). Colors, layout, spacing.</li>
              <li><strong>JavaScript</strong> — the behavior (the muscles). What happens when you click.</li>
            </ul>
            <p>As a full-stack developer, you'll write all three on the front end, plus a server language (we'll use JavaScript here too — Node.js) on the back end.</p>
          ` },
          { type: 'quiz',
            q: 'When you visit a website, which step happens FIRST?',
            options: ['Your browser renders the HTML', 'A DNS lookup finds the server\'s IP address', 'The server sends back JavaScript', 'The page appears on your screen'],
            answer: 1,
            why: 'Before anything else, your computer needs to know WHERE to send the request. DNS translates the human-readable name into an IP address.' },
          { type: 'drill-fill', parts: [
            'Across the network, browsers and servers usually converse using the ',
            { blank: 'http' }, ' protocol (often wrapped in TLS).',
          ] },
          { type: 'drill-reorder',
            intro: 'Order these from earliest to latest when loading a typical page.',
            lines: [
              'DNS resolves the hostname to an IP address',
              'A TCP connection is established to that IP',
              'The browser sends an HTTP request',
              'The server responds with HTTP (often HTML/CSS/JS)',
              'The browser parses and renders the document',
            ],
            correctOrder: [0, 1, 2, 3, 4],
          },
          { type: 'drill-predict',
            q: 'Right after DNS yields an IP, what usually happens before HTTP request bytes are exchanged reliably?',
            options: ['Rendering the DOM', 'Opening a TCP connection to that IP', 'Running bundled JavaScript', 'Writing to localStorage'],
            answer: 1,
            why: 'You need transport-layer connectivity (TCP/TLS) before meaningful HTTP dialogs; rendering comes much later.',
          },
          { type: 'jobbox', label: 'Employer-visible work', title: 'Practice how you\'d explain this in ~60 seconds', html: `
            <p>Hiring teams care that you think in <strong>layers</strong>—not only CSS bugs or API quirks.</p>
            <p>Pick one past project (even a todo app): describe chasing a symptom from UI → HTTP → handler → DB. That narrative maps cleanly to job interviews.</p>
          ` },
          { type: 'rubric', title: 'Interview signal vs. fluff', rows: [
            ['Thin answer', '\"The server sends me HTML\" (true, but vague)'],
            ['Strong signal', '\"DNS resolves the host → TCP connects → TLS if HTTPS → HTTP request/response → parse → scripts/styles → interactive page\"'],
          ] },
          { type: 'text', html: `<h3>Try it: your first web page</h3><p>Edit the HTML/CSS on the left. The browser preview on the right updates instantly. <strong>This is a real browser rendering real code.</strong></p>` },
          { type: 'htmlplay', starter: `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: system-ui;
      background: linear-gradient(135deg, #1e1b4b, #312e81);
      color: white;
      padding: 3rem;
      text-align: center;
    }
    h1 { color: #fbbf24; font-size: 36px; }
    button {
      background: #7c3aed; color: white;
      padding: 12px 28px; border: none;
      border-radius: 8px; font-size: 16px; cursor: pointer;
    }
    button:hover { background: #6d28d9; }
  </style>
</head>
<body>
  <h1>Hello, world!</h1>
  <p>I just rendered an HTML page in my browser.</p>
  <button onclick="alert('It works!')">Click me</button>
</body>
</html>` },
          { type: 'flashcards', cardIds: ['fc-dns', 'fc-http', 'fc-html-css-js', 'fc-status-200', 'fc-status-404'] },
        ]
      },
      {
        id: 'js-basics',
        title: 'JavaScript: Variables, Types, Logic',
        desc: 'JavaScript is the lingua franca of the web. Master these basics and you can write real programs in 30 minutes.',
        blocks: [
          { type: 'text', html: `
            <p>A program is just a list of instructions you give a computer. JavaScript reads them top-to-bottom and does what you say.</p>
            <h3>Variables — labeled boxes</h3>
            <p>A variable is a name you stick on a value so you can reuse it. Use <code>let</code> when the value can change, <code>const</code> when it can't.</p>
          ` },
          { type: 'code', lang: 'js', code: `let age = 25;          // a number, can change
const name = "Alex";   // text (a "string"), can't change
let isAdult = true;    // a boolean: true or false

age = 26;              // OK
// name = "Sam";       // error — const can't be reassigned` },
          { type: 'drill-fill', parts: [
            'Use ',
            { blank: 'const' }, ' for a binding you do not intend to reassign.',
          ] },
          { type: 'text', html: `
            <h3>Types you'll use every day</h3>
            <ul>
              <li><code>Number</code> — <code>1, 3.14, -5</code></li>
              <li><code>String</code> — <code>"hello"</code> (text, in quotes)</li>
              <li><code>Boolean</code> — <code>true</code> or <code>false</code></li>
              <li><code>Array</code> — <code>[1, 2, 3]</code> (an ordered list)</li>
              <li><code>Object</code> — <code>{ name: "Alex", age: 25 }</code> (a labeled bundle)</li>
              <li><code>null</code> / <code>undefined</code> — "no value" (we'll come back to this)</li>
            </ul>
            <h3>Try it yourself</h3>
            <p>Edit the code below and click <strong>Run</strong>. Use <code>console.log()</code> to print things.</p>
          ` },
          { type: 'play', lang: 'js', starter: `const name = "Alex";
const age = 25;

console.log("Hi, I'm " + name);
console.log("In 10 years I'll be " + (age + 10));

// Try changing the values, then add a new variable.` },
          { type: 'text', html: `
            <h3>Conditions: making decisions</h3>
            <p>An <code>if</code> statement runs code only when something is true.</p>
          ` },
          { type: 'play', lang: 'js', starter: `const score = 78;

if (score >= 90) {
  console.log("A");
} else if (score >= 80) {
  console.log("B");
} else if (score >= 70) {
  console.log("C");
} else {
  console.log("F");
}

// Change \`score\` and re-run!` },
          { type: 'callout', tone: 'tip', label: 'Operators cheat sheet', html: `
            <code>===</code> equal · <code>!==</code> not equal · <code>&gt;</code> greater · <code>&lt;</code> less · <code>&amp;&amp;</code> AND · <code>||</code> OR · <code>!</code> NOT
          ` },
          { type: 'quiz',
            q: 'Which keyword should you use for a value that NEVER changes after you set it?',
            options: ['var', 'let', 'const', 'final'],
            answer: 2,
            why: '`const` declares a constant — once assigned, it can\'t be reassigned. Use it by default; only use `let` when you know the value will change.' },
          { type: 'text', html: `<h3>Your first coding challenge</h3><p>Time to write code that's <em>graded</em>. Below is a function stub. Implement it so all the tests pass. Click "Run tests" when you're ready.</p>` },
          { type: 'challenge', challengeId: 'sum' },
          { type: 'challenge', challengeId: 'is-even' },
          { type: 'challenge', challengeId: 'fizzbuzz' },
          { type: 'flashcards', cardIds: ['fc-let-const', 'fc-eq', 'fc-falsy'] },
        ]
      },
      {
        id: 'js-functions',
        title: 'JavaScript: Functions & Arrays',
        desc: 'Functions are reusable mini-programs. Arrays are how we handle lists. You\'ll use them constantly.',
        blocks: [
          { type: 'text', html: `
            <p>A <strong>function</strong> is a named block of code you can run over and over with different inputs.</p>
          ` },
          { type: 'code', lang: 'js', code: `// Define it once...
function greet(name) {
  return "Hello, " + name + "!";
}

// ...call it many times.
console.log(greet("Alex"));   // "Hello, Alex!"
console.log(greet("Sam"));    // "Hello, Sam!"` },
          { type: 'text', html: `
            <p>Modern JavaScript also uses <strong>arrow functions</strong> — same idea, shorter syntax:</p>
          ` },
          { type: 'code', lang: 'js', code: `const greet = (name) => "Hello, " + name + "!";
const add = (a, b) => a + b;

console.log(add(2, 3)); // 5` },
          { type: 'text', html: `
            <h3>Arrays: lists of stuff</h3>
            <p>An array holds an ordered list of values. The first item is at index <code>0</code> (not 1).</p>
          ` },
          { type: 'play', lang: 'js', starter: `const fruits = ["apple", "banana", "cherry"];

console.log(fruits[0]);       // "apple"
console.log(fruits.length);   // 3

fruits.push("date");          // add to end
console.log(fruits);

// Common loop pattern:
fruits.forEach(fruit => {
  console.log("I love " + fruit);
});` },
          { type: 'text', html: `
            <h3>The big three: map, filter, reduce</h3>
            <p>These three functions are the bread and butter of working with data. Senior developers use them dozens of times a day.</p>
          ` },
          { type: 'play', lang: 'js', starter: `const numbers = [1, 2, 3, 4, 5];

// map: transform every item
const doubled = numbers.map(n => n * 2);
console.log(doubled);   // [2, 4, 6, 8, 10]

// filter: keep only items that match
const evens = numbers.filter(n => n % 2 === 0);
console.log(evens);     // [2, 4]

// reduce: combine into a single value
const sum = numbers.reduce((total, n) => total + n, 0);
console.log(sum);       // 15` },
          { type: 'callout', tone: 'tip', label: 'Why these matter', html: `In real apps, you constantly transform lists: "give me the names of all admin users", "give me the total cost of items in the cart", "convert this list of database rows to API responses". <code>map / filter / reduce</code> let you do this in one expressive line.` },
          { type: 'quiz',
            q: 'What does `[1, 2, 3].map(x => x + 10)` return?',
            options: ['[1, 2, 3]', '[11, 12, 13]', '6', '[10, 20, 30]'],
            answer: 1,
            why: '`map` calls the function on every item and returns a NEW array of the results. `x => x + 10` adds 10 to each number.' },
          { type: 'text', html: `<h3>Practice: array exercises</h3><p>Solve these to lock in <code>map</code>, <code>filter</code>, <code>reduce</code>. Each is auto-graded — turn the test rows green.</p>` },
          { type: 'challenge', challengeId: 'max-of-array' },
          { type: 'challenge', challengeId: 'sum-evens' },
          { type: 'challenge', challengeId: 'reverse-string' },
          { type: 'challenge', challengeId: 'count-vowels' },
          { type: 'challenge', challengeId: 'unique' },
          { type: 'flashcards', cardIds: ['fc-map', 'fc-filter', 'fc-reduce', 'fc-arrow'] },
        ]
      },
      {
        id: 'js-objects-async',
        title: 'JavaScript: Objects, Promises & Async',
        desc: 'Objects model real-world things. Promises let your code talk to the network without freezing.',
        blocks: [
          { type: 'text', html: `
            <h3>Objects: things with properties</h3>
            <p>An object groups related data (and behavior) under one name. It's how you'd represent a user, a product, a blog post — anything.</p>
          ` },
          { type: 'play', lang: 'js', starter: `const user = {
  name: "Alex",
  age: 25,
  email: "alex@example.com",
  isAdmin: false,
  greet() {
    return "Hi, I'm " + this.name;
  }
};

console.log(user.name);
console.log(user.greet());

// Add or change properties:
user.age = 26;
user.country = "USA";
console.log(user);` },
          { type: 'text', html: `
            <h3>Async: doing things that take time</h3>
            <p>Some operations don't finish instantly — fetching data from a server, reading a file, waiting for a user click. JavaScript doesn't freeze while it waits. Instead, it uses <strong>Promises</strong>.</p>
            <p>A promise is an IOU: "I'll give you a value later." You handle it with <code>async</code> / <code>await</code>:</p>
          ` },
          { type: 'play', lang: 'js', starter: `// A promise that resolves after 1 second:
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function demo() {
  console.log("Starting...");
  await wait(1000);
  console.log("1 second later!");
  await wait(500);
  console.log("Done!");
}

demo();` },
          { type: 'callout', tone: 'tip', label: 'The mental model', html: `<code>await</code> means "pause here until this thing finishes, then continue." But the rest of your program keeps running. JavaScript is <strong>non-blocking</strong> — it can do many things at once without using multiple threads.` },
          { type: 'text', html: `
            <h3>Real example: fetching from an API</h3>
            <p>This is what 80% of web app code looks like — get data from a server, do something with it.</p>
          ` },
          { type: 'code', lang: 'js', code: `async function loadUser() {
  const response = await fetch("https://api.example.com/users/1");
  const user = await response.json();
  console.log(user.name);
}

loadUser();` },
          { type: 'quiz',
            q: 'Why do we need `async`/`await` instead of just running code top-to-bottom?',
            options: ['Because computers are slow', 'Because some operations (network, files) take time, and we don\'t want to freeze the program while waiting', 'Because JavaScript can\'t do math', 'It makes code shorter'],
            answer: 1,
            why: 'JavaScript runs in a single thread. If you froze the thread to wait for the network, the entire UI would lock up. Async lets the program keep running and resume when the data arrives.' },
          { type: 'text', html: `<h3>Practice: working with objects</h3>` },
          { type: 'challenge', challengeId: 'pluck-names' },
          { type: 'challenge', challengeId: 'group-by-role' },
          { type: 'flashcards', cardIds: ['fc-promise', 'fc-async'] },
        ]
      },
      {
        id: 'apis-rest',
        title: 'APIs & REST',
        desc: 'An API is the contract between two pieces of software. REST is the dominant style on the web.',
        blocks: [
          { type: 'text', html: `
            <p>An <strong>API</strong> (Application Programming Interface) is just a set of URLs the server understands. You send a request, you get data back.</p>
            <h3>The 4 main HTTP "verbs"</h3>
            <ul>
              <li><strong>GET</strong> — read data. <em>"Give me user #5"</em> → <code>GET /users/5</code></li>
              <li><strong>POST</strong> — create data. <em>"Make a new user"</em> → <code>POST /users</code></li>
              <li><strong>PUT / PATCH</strong> — update data. <em>"Change user #5's email"</em> → <code>PATCH /users/5</code></li>
              <li><strong>DELETE</strong> — delete. <em>"Remove user #5"</em> → <code>DELETE /users/5</code></li>
            </ul>
            <p>That pattern — using HTTP verbs against resource URLs — is called <strong>REST</strong>.</p>
          ` },
          { type: 'callout', tone: 'tip', label: 'JSON is the language of APIs', html: `Servers don't send back HTML when responding to API calls — they send <strong>JSON</strong>, a lightweight text format that looks just like a JavaScript object: <code>{"id": 5, "name": "Alex"}</code>.` },
          { type: 'text', html: `
            <h3>Try a real API</h3>
            <p>Run this code. It calls a free public API and prints the result. (You need internet for this one to work.)</p>
          ` },
          { type: 'play', lang: 'js', starter: `async function getJoke() {
  const res = await fetch("https://official-joke-api.appspot.com/random_joke");
  const joke = await res.json();
  console.log(joke.setup);
  console.log("→ " + joke.punchline);
}

getJoke();` },
          { type: 'text', html: `
            <h3>Status codes — what the server is telling you</h3>
            <ul>
              <li><strong>2xx</strong> — success. <code>200 OK</code>, <code>201 Created</code>.</li>
              <li><strong>3xx</strong> — redirect. <code>301 Moved Permanently</code>.</li>
              <li><strong>4xx</strong> — <em>your</em> fault (bad request). <code>404 Not Found</code>, <code>401 Unauthorized</code>.</li>
              <li><strong>5xx</strong> — <em>server's</em> fault. <code>500 Internal Server Error</code>.</li>
            </ul>
          ` },
          { type: 'text', html: `
            <h3>What about GraphQL?</h3>
            <p>GraphQL is an alternative to REST where the client sends a <em>query</em> describing exactly the fields it wants. Useful when REST endpoints return too much or too little data. Most companies still use REST, but GraphQL is common at Facebook, Shopify, GitHub, etc.</p>
          ` },
          { type: 'quiz',
            q: 'You want to delete a blog post. Which HTTP method should you use?',
            options: ['GET /posts/123', 'POST /posts/delete/123', 'DELETE /posts/123', 'REMOVE /posts/123'],
            answer: 2,
            why: 'REST maps the HTTP verb DELETE onto the resource URL. The verb describes the action; the URL identifies the thing.' },
        ]
      },
      {
        id: 'databases',
        title: 'Databases: SQL vs NoSQL',
        desc: 'Where your data lives. The single most important infrastructure decision in any app.',
        blocks: [
          { type: 'text', html: `
            <p>An app without a database is just a fancy calculator. Databases <strong>persist</strong> data — they remember things after the program stops.</p>
            <h3>Two big families</h3>
            <ul>
              <li><strong>SQL (relational)</strong> — data lives in tables with strict columns, like a spreadsheet. Examples: <strong>PostgreSQL, MySQL, SQLite</strong>.</li>
              <li><strong>NoSQL (document)</strong> — data lives as flexible JSON-like documents. Examples: <strong>MongoDB, DynamoDB, Firestore</strong>.</li>
            </ul>
          ` },
          { type: 'text', html: `
            <h3>SQL: thinking in tables</h3>
            <p>You design a <strong>schema</strong> upfront — what columns each table has — and the database enforces it. You query with <strong>SQL</strong> (Structured Query Language).</p>
          ` },
          { type: 'code', lang: 'sql', code: `-- A users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert a row
INSERT INTO users (name, email) VALUES ('Alex', 'alex@x.com');

-- Read rows
SELECT id, name FROM users WHERE email = 'alex@x.com';

-- Update
UPDATE users SET name = 'Alexandra' WHERE id = 1;

-- Delete
DELETE FROM users WHERE id = 1;` },
          { type: 'callout', tone: 'tip', label: 'Relationships', html: `The "relational" part is that tables can reference each other. A <code>posts</code> table can have a <code>user_id</code> column pointing back to <code>users.id</code>. SQL <code>JOIN</code>s let you query across tables: "give me every post AND its author's name".` },
          { type: 'text', html: `
            <h3>NoSQL: thinking in documents</h3>
            <p>MongoDB stores documents directly as JSON. No fixed schema — every document can look different. Easier to start, harder to keep consistent at scale.</p>
          ` },
          { type: 'code', lang: 'js', code: `// MongoDB documents in a "users" collection
{
  _id: "abc123",
  name: "Alex",
  email: "alex@x.com",
  posts: [                           // arrays embedded right in the document
    { title: "Hello world", likes: 10 },
    { title: "Async in JS", likes: 42 }
  ]
}` },
          { type: 'text', html: `
            <h3>Which should you use?</h3>
            <ul>
              <li><strong>Default to PostgreSQL.</strong> It's free, battle-tested, fast, supports JSON columns, and you can scale it for years.</li>
              <li><strong>Use MongoDB</strong> when your data is genuinely document-shaped (logs, varied content) or you're prototyping fast.</li>
              <li><strong>Senior devs know both</strong>. The "right" choice depends on data shape and access patterns.</li>
            </ul>
          ` },
          { type: 'quiz',
            q: 'You\'re building a banking app where every transaction needs strict consistency and rows reference each other (accounts → transactions → users). What should you reach for first?',
            options: ['MongoDB', 'PostgreSQL', 'A text file', 'Redis'],
            answer: 1,
            why: 'Banking is the textbook case for relational SQL: strict schemas, foreign keys, ACID transactions. PostgreSQL gives you all of those out of the box.' },
          { type: 'text', html: `<h3>Try real SQL — right here</h3><p>Below is an actual SQLite database running in your browser. The schema and some sample data are already loaded. Edit the query and click ▶ Run.</p>` },
          { type: 'sqlplay',
            schema: `CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT,
  email TEXT,
  country TEXT,
  created_at TEXT
);
CREATE TABLE posts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  title TEXT,
  likes INTEGER
);`,
            seed: `INSERT INTO users VALUES
  (1, 'Alex',  'alex@x.com',  'US', '2025-01-15'),
  (2, 'Bea',   'bea@x.com',   'UK', '2025-02-03'),
  (3, 'Cleo',  'cleo@x.com',  'US', '2025-02-20'),
  (4, 'Dan',   'dan@x.com',   'CA', '2025-03-11'),
  (5, 'Eve',   'eve@x.com',   'UK', '2025-04-01');
INSERT INTO posts VALUES
  (1, 1, 'Hello world',          50),
  (2, 1, 'Async in JS',          120),
  (3, 2, 'Why I love Postgres',  90),
  (4, 3, 'Docker tips',          200),
  (5, 3, 'My first deploy',       30),
  (6, 5, 'Reading list',          15);`,
            starter: `-- Try changing the query and re-running.
-- Examples below — uncomment one at a time.

SELECT * FROM users;

-- SELECT name, country FROM users WHERE country = 'US';
-- SELECT country, COUNT(*) AS users FROM users GROUP BY country;
-- SELECT u.name, p.title, p.likes
--   FROM users u JOIN posts p ON p.user_id = u.id
--   ORDER BY p.likes DESC;
` },
          { type: 'flashcards', cardIds: ['fc-sql-vs-nosql', 'fc-pk', 'fc-fk', 'fc-join', 'fc-acid'] },
        ]
      },
      {
        id: 'git-github',
        title: 'Git & GitHub: Time Travel for Code',
        desc: 'How professional developers track changes, collaborate, and never lose work.',
        blocks: [
          { type: 'text', html: `
            <p><strong>Git</strong> is a tool that records every change you make to your code. <strong>GitHub</strong> is a website that hosts those changes online so you can collaborate with others (and back up your work).</p>
            <p>Every professional dev uses Git. Every. Single. One.</p>
            <h3>The mental model</h3>
            <p>Think of your project as a tree of <strong>commits</strong>, where each commit is a saved snapshot. You can rewind, branch off, merge things back together — all without losing history.</p>
          ` },
          { type: 'code', lang: 'bash', code: `# One-time setup
git config --global user.name "Your Name"
git config --global user.email "you@example.com"

# Start tracking a project
git init

# See what's changed
git status

# Stage files for the next snapshot
git add .

# Save the snapshot, with a message
git commit -m "Add login form"

# View history
git log --oneline` },
          { type: 'text', html: `
            <h3>Branching: the killer feature</h3>
            <p>You don't make changes directly to the main code. You make a <strong>branch</strong>, do your work, and merge it back when it's ready. This lets multiple people work in parallel without stepping on each other.</p>
          ` },
          { type: 'code', lang: 'bash', code: `# Make a new branch and switch to it
git checkout -b add-search-feature

# (work on your code, commit a few times)

# Push the branch to GitHub
git push -u origin add-search-feature

# On GitHub, open a "Pull Request" — your team reviews it
# Once approved, merge it into main` },
          { type: 'callout', tone: 'warn', label: 'Pro tip', html: `Commit small and often. A good commit message finishes this sentence: "If applied, this commit will ___." E.g. <code>"Fix login button on mobile"</code>, not <code>"updates"</code>.` },
          { type: 'quiz',
            q: 'You\'re working on a new feature and want to keep your changes separate from the main code until ready. What do you do?',
            options: ['Edit files directly on the main branch', 'Make a new Git branch and work there', 'Email the files to yourself', 'Copy the project folder and rename it'],
            answer: 1,
            why: 'Branches are isolated workspaces. You can experiment freely, and only merge back when it\'s polished and reviewed.' },
          { type: 'text', html: `<h3>Practice in a fake terminal</h3><p>Try the commands you just learned. This is a sandbox — nothing real happens. Complete the tasks below to mark this exercise done.</p>` },
          { type: 'terminal',
            tasks: [
              { id: 'git-init', desc: 'Initialize a new git repository', match: /^git\s+init\b/ },
              { id: 'git-status', desc: 'Check the status of your working directory', match: /^git\s+status\b/ },
              { id: 'git-add', desc: 'Stage all changes for commit', match: /^git\s+add\s+(\.|--all|-A)\b/ },
              { id: 'git-commit', desc: 'Commit them with a message', match: /^git\s+commit\s+-m\s+["'].+["']/ },
              { id: 'git-branch', desc: 'Create and switch to a new branch called "feature"', match: /^git\s+(checkout\s+-b|switch\s+-c)\s+feature\b/ },
            ]
          },
          { type: 'flashcards', cardIds: ['fc-git-add', 'fc-git-commit', 'fc-git-push', 'fc-git-branch', 'fc-git-merge'] },
        ]
      },
      {
        id: 'docker',
        title: 'Docker: Containers in Plain English',
        desc: 'How to package an app so it runs the same on your laptop, your friend\'s laptop, and the cloud.',
        blocks: [
          { type: 'text', html: `
            <p>"It works on my machine" is the oldest joke in software. Docker kills it dead.</p>
            <p>A <strong>container</strong> is a tiny, isolated, portable box that contains your app <em>plus</em> everything it needs to run — the language runtime, libraries, system tools, config, the works. Hand someone the container and it just runs. Anywhere.</p>
            <h3>How it differs from a VM</h3>
            <ul>
              <li><strong>VM</strong> = simulates a whole computer (slow to start, big files).</li>
              <li><strong>Container</strong> = shares the host's kernel but isolates everything else (starts in seconds, megabytes not gigabytes).</li>
            </ul>
          ` },
          { type: 'text', html: `
            <h3>The Dockerfile — a recipe for your container</h3>
          ` },
          { type: 'code', lang: 'dockerfile', code: `# Start from a base image with Node.js installed
FROM node:20

# Set working directory inside the container
WORKDIR /app

# Copy package files first (for caching)
COPY package*.json ./
RUN npm install

# Copy the rest of the source
COPY . .

# What port the app listens on
EXPOSE 3000

# What command runs when the container starts
CMD ["node", "server.js"]` },
          { type: 'code', lang: 'bash', code: `# Build the image (do this once)
docker build -t my-app .

# Run a container from the image
docker run -p 3000:3000 my-app

# That's it — your app is now running in an isolated box.` },
          { type: 'callout', tone: 'tip', label: 'Why this is huge', html: `Production servers, your laptop, your CI test runner, and the cloud all run the <em>exact same container</em>. No more "works on my machine." This is the foundation of modern deployment.` },
          { type: 'quiz',
            q: 'What\'s the main difference between a Docker container and a virtual machine?',
            options: ['Containers cost money, VMs are free', 'Containers share the host OS kernel and start in seconds; VMs simulate a full computer and take much longer', 'There is no difference', 'VMs only run Linux'],
            answer: 1,
            why: 'VMs virtualize hardware (heavy). Containers virtualize the process — they share the host kernel but isolate the file system, network, and processes (light, fast).' },
        ]
      },
      {
        id: 'security-basics',
        title: 'Security Basics Every Dev Must Know',
        desc: 'You don\'t need to be a hacker, but you absolutely need to know these or you\'ll ship dangerous code.',
        blocks: [
          { type: 'text', html: `
            <p>Security bugs cost companies billions and end careers. The good news: 80% of vulnerabilities come from a small list of well-known mistakes. Learn them now and avoid them forever.</p>
            <h3>The big four</h3>
            <h3>1. SQL Injection</h3>
            <p>If you build SQL by string-concatenating user input, an attacker can inject their own SQL.</p>
          ` },
          { type: 'code', lang: 'js', code: `// 🚨 NEVER DO THIS
const sql = "SELECT * FROM users WHERE name = '" + userInput + "'";

// If userInput = "'; DROP TABLE users; --"
// you just deleted your entire users table.

// ✅ DO THIS — parameterized query
db.query("SELECT * FROM users WHERE name = $1", [userInput]);` },
          { type: 'text', html: `
            <h3>2. Cross-Site Scripting (XSS)</h3>
            <p>If you take user input and stick it into HTML without escaping, an attacker can inject <code>&lt;script&gt;</code> tags that run in other users' browsers.</p>
            <p><strong>Fix:</strong> always escape HTML. Modern frameworks (React, Vue) do this for you by default.</p>
            <h3>3. Authentication mistakes</h3>
            <ul>
              <li><strong>Never store passwords in plain text.</strong> Hash them with <code>bcrypt</code> or <code>argon2</code>.</li>
              <li>Use HTTPS (TLS) for everything. No exceptions.</li>
              <li>Don't roll your own auth — use established libraries (NextAuth, Auth0, Clerk, Supabase Auth).</li>
            </ul>
            <h3>4. Secrets in code</h3>
            <p>Never commit API keys, database passwords, or tokens to git. Put them in <code>.env</code> files and add <code>.env</code> to <code>.gitignore</code>.</p>
          ` },
          { type: 'callout', tone: 'warn', label: 'OWASP Top 10', html: `Bookmark <strong>owasp.org/Top10</strong>. It's the industry-standard list of the most common security risks. Read it once a year.` },
          { type: 'quiz',
            q: 'A user submits the comment `<script>alert("hacked")</script>`. You display it on the page using innerHTML. What kind of attack is this?',
            options: ['SQL Injection', 'Cross-Site Scripting (XSS)', 'DDoS', 'Phishing'],
            answer: 1,
            why: 'XSS = injecting executable JavaScript into pages other users see. The fix is to escape (or properly render as text) any user-generated HTML.' },
        ]
      },
    ]
  },

  // ========================================================================
  // 2. ARCHITECTURE
  // ========================================================================
  {
    id: 'architecture',
    title: 'Architecture',
    icon: 'AR',
    color: 'var(--c-architecture)',
    desc: 'How to organize code so apps stay maintainable as they grow from 100 lines to 1 million.',
    lessons: [
      {
        id: 'why-architecture',
        title: 'Why Architecture Matters',
        desc: 'Code that works isn\'t enough. Code that\'s easy to change is what separates juniors from seniors.',
        blocks: [
          { type: 'text', html: `
            <p>Most code isn't written once and shipped. It's read, edited, and extended for years by many people. <strong>Architecture</strong> is the set of decisions that make those future edits cheap (or expensive).</p>
            <h3>The cost curve</h3>
            <p>Bad architecture in a small app feels fine. By month 6, you're afraid to touch anything because <em>every change breaks something else</em>. That's the moment teams beg for a rewrite — usually too late.</p>
            <h3>The two principles</h3>
            <ol>
              <li><strong>Separation of concerns</strong> — each piece of code does one job. UI code shouldn't talk to the database directly.</li>
              <li><strong>High cohesion, low coupling</strong> — things that change together live together; things that don't, don't depend on each other.</li>
            </ol>
            <p>Every architectural pattern you'll learn (MVC, microservices, hexagonal, etc.) is a different answer to: <em>how do we apply those two principles?</em></p>
          ` },
          { type: 'callout', tone: 'tip', label: 'Senior insight', html: `"Junior devs optimize for writing code. Senior devs optimize for <em>changing</em> code." Architecture is the discipline of designing systems that are easy to change.` },
          { type: 'quiz',
            q: 'What is "low coupling" and why does it matter?',
            options: ['Code with few comments', 'Components depend on each other as little as possible, so changing one doesn\'t break others', 'Slow code', 'Using fewer libraries'],
            answer: 1,
            why: 'Low coupling = independence. When you change a function, you want minimal ripple effects. This is the #1 way to keep large codebases sane.' },
        ]
      },
      {
        id: 'mvc',
        title: 'The MVC Pattern',
        desc: 'The most common way to organize a web backend. Once you see it, you see it everywhere.',
        blocks: [
          { type: 'text', html: `
            <p><strong>MVC = Model · View · Controller.</strong> A way of splitting your app into three layers, each with one job:</p>
            <ul>
              <li><strong>Model</strong> — the data and the rules about it (talks to the database).</li>
              <li><strong>View</strong> — what the user sees (HTML, JSON response).</li>
              <li><strong>Controller</strong> — the traffic cop. Receives requests, calls models, returns views.</li>
            </ul>
          ` },
          { type: 'diagram', svg: `
            <svg viewBox="0 0 600 240" xmlns="http://www.w3.org/2000/svg">
              <rect x="40" y="100" width="120" height="60" rx="8" fill="#1c1f2e" stroke="#a78bfa" stroke-width="2"/>
              <text x="100" y="135" text-anchor="middle" fill="#fff" font-family="Inter" font-size="14" font-weight="700">Controller</text>
              <rect x="240" y="20" width="120" height="60" rx="8" fill="#1c1f2e" stroke="#5eead4" stroke-width="2"/>
              <text x="300" y="55" text-anchor="middle" fill="#fff" font-family="Inter" font-size="14" font-weight="700">View</text>
              <rect x="240" y="180" width="120" height="60" rx="8" fill="#1c1f2e" stroke="#facc15" stroke-width="2"/>
              <text x="300" y="215" text-anchor="middle" fill="#fff" font-family="Inter" font-size="14" font-weight="700">Model</text>
              <rect x="440" y="180" width="120" height="60" rx="8" fill="#1c1f2e" stroke="#ef4444" stroke-width="2"/>
              <text x="500" y="210" text-anchor="middle" fill="#fff" font-family="Inter" font-size="13" font-weight="700">Database</text>
              <line x1="160" y1="120" x2="240" y2="60" stroke="#5eead4" stroke-width="2"/>
              <line x1="160" y1="140" x2="240" y2="200" stroke="#facc15" stroke-width="2"/>
              <line x1="360" y1="210" x2="440" y2="210" stroke="#ef4444" stroke-width="2"/>
            </svg>
          ` },
          { type: 'text', html: `
            <h3>Walking through a request</h3>
            <p>User clicks "Show me my profile":</p>
            <ol>
              <li><strong>Browser → Controller:</strong> <code>GET /profile</code></li>
              <li><strong>Controller → Model:</strong> "fetch user #42 from DB"</li>
              <li><strong>Model → Controller:</strong> returns user data</li>
              <li><strong>Controller → View:</strong> "render the profile template with this data"</li>
              <li><strong>View → Browser:</strong> sends HTML/JSON</li>
            </ol>
          ` },
          { type: 'code', lang: 'js', code: `// MODEL — knows about data
class User {
  static async findById(id) {
    return db.query("SELECT * FROM users WHERE id = $1", [id]);
  }
}

// CONTROLLER — coordinates
async function getProfile(req, res) {
  const user = await User.findById(req.params.id);
  res.render("profile", { user });   // hand off to the view
}

// VIEW — just presents
// profile.html: <h1>Hello {{ user.name }}</h1>` },
          { type: 'quiz',
            q: 'Where should you put database queries in MVC?',
            options: ['In the View', 'In the Controller', 'In the Model', 'Anywhere works'],
            answer: 2,
            why: 'Models own data and persistence logic. Keeping queries out of controllers means you can swap databases or reuse query logic across many controllers.' },
        ]
      },
      {
        id: 'monolith-vs-micro',
        title: 'Monolith vs Microservices',
        desc: 'The biggest architectural debate of the 2010s — and the answer surprises most people.',
        blocks: [
          { type: 'text', html: `
            <h3>Monolith</h3>
            <p>One big codebase, one deployment. All features (users, billing, search, notifications) live in the same app and share a database.</p>
            <ul>
              <li>✅ Simple to develop and deploy</li>
              <li>✅ Easy to refactor across modules</li>
              <li>❌ Slow to scale — one bug crashes everything</li>
              <li>❌ Big teams step on each other</li>
            </ul>
            <h3>Microservices</h3>
            <p>Many small apps, each owning one capability, talking over the network.</p>
            <ul>
              <li>✅ Teams own and scale services independently</li>
              <li>✅ Failure of one service doesn't kill the system (if designed well)</li>
              <li>❌ Network calls between services are slow and unreliable</li>
              <li>❌ Distributed systems are <strong>hard</strong> — debugging across 30 services is brutal</li>
            </ul>
          ` },
          { type: 'callout', tone: 'warn', label: 'The senior take', html: `<strong>Start with a monolith. Always.</strong> Even at companies like Shopify and Stack Overflow, the monolith powers billions in revenue. Only break out a microservice when a specific scaling, ownership, or deployment problem demands it. Premature microservices are the #1 architectural mistake of 2010-2020.` },
          { type: 'text', html: `
            <h3>The middle path: a "modular monolith"</h3>
            <p>One codebase, but rigorously separated into modules with clear boundaries. You get the simplicity of a monolith with most of the discipline of microservices. This is what most healthy companies actually do.</p>
          ` },
          { type: 'quiz',
            q: 'You\'re a 3-person startup building an MVP. What architecture should you start with?',
            options: ['100+ microservices for future-proofing', 'A monolith — keep it simple, ship fast', 'Serverless functions for everything', 'It doesn\'t matter'],
            answer: 1,
            why: 'Microservices have huge operational overhead. A small team will drown in it. Build a monolith, keep it clean, split later only when a real pain point demands it.' },
        ]
      },
      {
        id: 'event-driven',
        title: 'Event-Driven Architecture',
        desc: 'How modern systems decouple components by talking through events instead of direct calls.',
        blocks: [
          { type: 'text', html: `
            <p>In a traditional system, A calls B directly. If B is slow or down, A is stuck. <strong>Event-driven</strong> systems flip this: A <em>publishes an event</em> (<em>"a user signed up"</em>) into a queue, and any number of services <em>subscribe</em> to react to it.</p>
            <h3>Example</h3>
            <p>When a user signs up:</p>
            <ul>
              <li>The auth service emits <code>UserSignedUp</code></li>
              <li>The email service hears it → sends welcome email</li>
              <li>The analytics service hears it → records the event</li>
              <li>The CRM service hears it → adds them as a lead</li>
            </ul>
            <p>The auth service doesn't know or care about any of those listeners. They can be added/removed/changed freely.</p>
          ` },
          { type: 'text', html: `
            <h3>Tools you'll hear about</h3>
            <ul>
              <li><strong>Kafka</strong> — the industry standard for high-throughput event streams</li>
              <li><strong>RabbitMQ</strong> — older, simpler message queue</li>
              <li><strong>AWS SQS / SNS</strong> — managed equivalents on AWS</li>
              <li><strong>Redis Streams / Pub/Sub</strong> — lightweight option</li>
            </ul>
          ` },
          { type: 'callout', tone: 'tip', label: 'Tradeoff', html: `Event-driven systems are very loose, which is great for scaling teams — but harder to reason about. "What happens when X?" becomes a treasure hunt across many services. Use it when you have multiple independent reactions to the same event.` },
          { type: 'quiz',
            q: 'What\'s the main benefit of an event-driven architecture?',
            options: ['It\'s faster than direct calls', 'Producers don\'t need to know about consumers — easy to add new reactions to events', 'It uses less memory', 'It avoids needing a database'],
            answer: 1,
            why: 'Decoupling. The producer fires the event and forgets. New consumers can be added without changing the producer at all.' },
        ]
      },
      {
        id: 'clean-code',
        title: 'Writing Code That Doesn\'t Hurt',
        desc: 'A handful of habits that immediately mark you as a senior, regardless of experience.',
        blocks: [
          { type: 'text', html: `
            <h3>1. Name things well</h3>
            <p>Code is read 10x more than it's written. <code>const d = new Date()</code> tells me nothing. <code>const accountCreatedAt = new Date()</code> tells me everything.</p>
            <h3>2. Functions do one thing</h3>
            <p>If you can't describe what a function does without saying "and", split it.</p>
            <h3>3. Avoid deep nesting</h3>
            <p>Use <strong>early returns</strong> to flatten code:</p>
          ` },
          { type: 'code', lang: 'js', code: `// 😐 Pyramid of doom
function process(user) {
  if (user) {
    if (user.isActive) {
      if (user.email) {
        sendEmail(user.email);
      }
    }
  }
}

// ✅ Flat with early returns
function process(user) {
  if (!user) return;
  if (!user.isActive) return;
  if (!user.email) return;
  sendEmail(user.email);
}` },
          { type: 'text', html: `
            <h3>4. Don't comment WHAT, comment WHY</h3>
            <p>The code already shows what it does. A comment should explain <em>why</em> a non-obvious choice was made.</p>
            <h3>5. Tests are documentation that runs</h3>
            <p>A test file is the best documentation a function can have. We'll cover testing in System Design.</p>
            <h3>6. Refactor in small steps</h3>
            <p>Make the change easy (sometimes hard), then make the easy change. — Kent Beck</p>
          ` },
          { type: 'quiz',
            q: 'Which is the better function name?',
            options: ['`function doStuff(x, y)`', '`function calculateMonthlyRevenue(orders, taxRate)`', '`function f(a, b)`', '`function process(data, opts)`'],
            answer: 1,
            why: 'Specific names are self-documenting. You can read the call site and instantly know what\'s happening. This is the cheapest, highest-leverage code quality habit.' },
          { type: 'text', html: `<h3>Bug-hunt practice</h3><p>Reading other people's code (and finding what's wrong with it) is THE most-used real-world skill. Two short exercises:</p>` },
          { type: 'challenge', challengeId: 'bug-greet' },
          { type: 'challenge', challengeId: 'bug-sum-array' },
          { type: 'flashcards', cardIds: ['fc-coupling', 'fc-cohesion', 'fc-mvc'] },
        ]
      },
    ]
  },

  // ========================================================================
  // 3. CLOUD
  // ========================================================================
  {
    id: 'cloud',
    title: 'Cloud',
    icon: '☁',
    color: 'var(--c-cloud)',
    desc: 'AWS, Azure, GCP. The infrastructure that runs the modern web.',
    lessons: [
      {
        id: 'what-is-cloud',
        title: 'What "The Cloud" Actually Is',
        desc: 'Strip the marketing. The cloud is just other people\'s computers — but really, really useful ones.',
        blocks: [
          { type: 'text', html: `
            <p>Before the cloud, if you wanted to launch a website you had to:</p>
            <ol>
              <li>Buy a physical server</li>
              <li>Install it in a data center</li>
              <li>Maintain it (cooling, power, backups)</li>
              <li>Pray it didn't catch fire</li>
            </ol>
            <p>The cloud lets you rent that server (and 200 other services) by the second, scale it instantly, and tear it down when done. You pay only for what you use.</p>
            <h3>The big three</h3>
            <ul>
              <li><strong>AWS (Amazon Web Services)</strong> — the largest, most mature, intimidating menu of services. ~30% of the cloud market.</li>
              <li><strong>Azure (Microsoft)</strong> — strong with enterprise/Windows shops.</li>
              <li><strong>GCP (Google Cloud)</strong> — strong with data, ML, and Kubernetes.</li>
            </ul>
            <p>Pick one to learn deeply (start with <strong>AWS</strong>), and you can pick up the others quickly.</p>
          ` },
          { type: 'callout', tone: 'tip', label: 'XaaS — service tiers', html: `
            <strong>IaaS</strong> (Infrastructure-as-a-Service): you rent raw VMs (e.g. EC2). You manage the OS, runtime, app.<br/>
            <strong>PaaS</strong> (Platform-as-a-Service): you give it your code, it runs it (e.g. Heroku, Vercel, App Engine).<br/>
            <strong>SaaS</strong> (Software-as-a-Service): you use someone's app over the web (e.g. Gmail, Notion).<br/>
            <strong>Serverless</strong> / FaaS: you upload a function, the cloud runs it on demand (e.g. AWS Lambda).
          ` },
          { type: 'quiz',
            q: 'Which cloud service model lets you upload a single function and have the cloud run it on demand without managing any servers?',
            options: ['IaaS', 'PaaS', 'Serverless / FaaS', 'SaaS'],
            answer: 2,
            why: 'Serverless / Function-as-a-Service. You don\'t even pick the machine — the platform spins up, runs your function, and tears it down. You pay per millisecond of execution.' },
        ]
      },
      {
        id: 'aws-essentials',
        title: 'AWS: The 8 Services You Must Know',
        desc: 'AWS has 200+ services. As a full-stack dev, you need to be fluent in these eight.',
        blocks: [
          { type: 'text', html: `
            <h3>The essential AWS toolkit</h3>
            <ul>
              <li><strong>EC2</strong> — virtual machines. The basic "give me a Linux box" service.</li>
              <li><strong>S3</strong> — object storage. Where you put files, images, backups, video. Cheap and infinite.</li>
              <li><strong>RDS</strong> — managed databases (PostgreSQL, MySQL). AWS handles backups & patching.</li>
              <li><strong>Lambda</strong> — run functions on demand without managing servers.</li>
              <li><strong>CloudFront</strong> — CDN. Caches your static files at 400+ edge locations worldwide.</li>
              <li><strong>Route 53</strong> — DNS. Point domains at services.</li>
              <li><strong>IAM</strong> — permissions. Who can do what.</li>
              <li><strong>VPC</strong> — virtual private network. Isolates your resources.</li>
            </ul>
            <p>Master these and you can host real production apps. Everything else (ECS, EKS, SQS, DynamoDB, etc.) builds on this foundation.</p>
          ` },
          { type: 'callout', tone: 'warn', label: 'The cost trap', html: `AWS bills are notorious. <em>Always</em> set up <strong>billing alarms</strong> on day one (Billing → Alarms → "Alert me if my bill exceeds $10"). Forgotten EC2 instances and S3 traffic have produced legendary horror stories.` },
          { type: 'text', html: `
            <h3>How a typical app uses AWS</h3>
          ` },
          { type: 'diagram', svg: `
            <svg viewBox="0 0 700 280" xmlns="http://www.w3.org/2000/svg">
              <rect x="20" y="120" width="100" height="50" rx="6" fill="#1c1f2e" stroke="#5eead4" stroke-width="2"/>
              <text x="70" y="142" text-anchor="middle" fill="#fff" font-size="13" font-weight="700">User</text>
              <text x="70" y="158" text-anchor="middle" fill="#9aa0b8" font-size="11">browser</text>
              <rect x="170" y="120" width="100" height="50" rx="6" fill="#1c1f2e" stroke="#a78bfa" stroke-width="2"/>
              <text x="220" y="142" text-anchor="middle" fill="#fff" font-size="13" font-weight="700">CloudFront</text>
              <text x="220" y="158" text-anchor="middle" fill="#9aa0b8" font-size="10">CDN</text>
              <rect x="320" y="40" width="100" height="50" rx="6" fill="#1c1f2e" stroke="#facc15" stroke-width="2"/>
              <text x="370" y="62" text-anchor="middle" fill="#fff" font-size="13" font-weight="700">S3</text>
              <text x="370" y="78" text-anchor="middle" fill="#9aa0b8" font-size="10">static files</text>
              <rect x="320" y="200" width="100" height="50" rx="6" fill="#1c1f2e" stroke="#22c55e" stroke-width="2"/>
              <text x="370" y="222" text-anchor="middle" fill="#fff" font-size="13" font-weight="700">EC2</text>
              <text x="370" y="238" text-anchor="middle" fill="#9aa0b8" font-size="10">app server</text>
              <rect x="470" y="200" width="100" height="50" rx="6" fill="#1c1f2e" stroke="#ef4444" stroke-width="2"/>
              <text x="520" y="222" text-anchor="middle" fill="#fff" font-size="13" font-weight="700">RDS</text>
              <text x="520" y="238" text-anchor="middle" fill="#9aa0b8" font-size="10">database</text>
              <line x1="120" y1="145" x2="170" y2="145" stroke="#5eead4" stroke-width="2"/>
              <line x1="270" y1="135" x2="320" y2="80" stroke="#facc15" stroke-width="2"/>
              <line x1="270" y1="155" x2="320" y2="220" stroke="#22c55e" stroke-width="2"/>
              <line x1="420" y1="225" x2="470" y2="225" stroke="#ef4444" stroke-width="2"/>
            </svg>
          ` },
          { type: 'quiz',
            q: 'Which AWS service is best for storing user-uploaded photos and videos?',
            options: ['EC2', 'RDS', 'S3', 'Lambda'],
            answer: 2,
            why: 'S3 is object storage built for files of any size. It\'s cheap, durable (99.999999999%), and infinitely scalable.' },
        ]
      },
      {
        id: 'cicd',
        title: 'CI/CD: Ship to Production Safely',
        desc: 'How modern teams ship code to live users many times a day without breaking everything.',
        blocks: [
          { type: 'text', html: `
            <p><strong>CI</strong> = Continuous Integration. Every push automatically runs tests.<br/>
            <strong>CD</strong> = Continuous Deployment (or Delivery). Once tests pass, the code automatically goes to production (or to a one-click button).</p>
            <h3>The pipeline</h3>
            <ol>
              <li>Dev pushes code to a GitHub branch</li>
              <li>CI runs: install dependencies → run linter → run tests → build</li>
              <li>If anything fails, the dev gets notified and the merge is blocked</li>
              <li>If it passes and gets merged, CD deploys it (to staging, then production)</li>
            </ol>
          ` },
          { type: 'code', lang: 'yaml', code: `# .github/workflows/ci.yml — a real GitHub Actions config
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm test
      - run: npm run build` },
          { type: 'callout', tone: 'tip', label: 'Tools', html: `<strong>GitHub Actions</strong> (free, easy, ubiquitous) · <strong>GitLab CI</strong> · <strong>CircleCI</strong> · <strong>Jenkins</strong> (older, self-hosted). For deployment: <strong>Vercel</strong>, <strong>Netlify</strong>, <strong>Render</strong>, <strong>Fly.io</strong>, or roll your own with AWS/Docker.` },
          { type: 'quiz',
            q: 'Why do teams set up CI to run tests on every push?',
            options: ['To make GitHub look fancy', 'To catch bugs immediately, before code reaches production', 'It\'s required by law', 'To slow down development'],
            answer: 1,
            why: 'CI gives instant feedback. A bug caught in CI takes minutes to fix. The same bug in production can cost the company thousands.' },
        ]
      },
      {
        id: 'kubernetes',
        title: 'Kubernetes: The 10-Minute Overview',
        desc: 'You don\'t need to be a K8s expert, but you should know what it does and when to reach for it.',
        blocks: [
          { type: 'text', html: `
            <p><strong>Kubernetes (K8s)</strong> is an orchestrator for containers. You hand it a pile of Docker containers and rules ("always keep 3 of these running, restart if they crash, route 50% of traffic here"), and it figures out where to put them across a cluster of machines.</p>
            <h3>What K8s does for you</h3>
            <ul>
              <li><strong>Self-healing</strong> — restarts crashed containers</li>
              <li><strong>Auto-scaling</strong> — adds more containers when traffic grows</li>
              <li><strong>Load balancing</strong> — spreads requests across containers</li>
              <li><strong>Rolling updates</strong> — deploys new versions with zero downtime</li>
              <li><strong>Service discovery</strong> — containers find each other by name</li>
            </ul>
          ` },
          { type: 'callout', tone: 'warn', label: 'Don\'t over-reach', html: `K8s is brutally complex. If you have <10 services and <100 servers, simpler tools (ECS Fargate, Cloud Run, Render, Fly.io) will save your sanity. Learn K8s when you need it, not before — but make sure you can <em>read</em> a Kubernetes config when you see one in an interview.` },
          { type: 'quiz',
            q: 'Which problem does Kubernetes primarily solve?',
            options: ['Writing the application code', 'Coordinating many containers across many servers (scheduling, healing, scaling)', 'Database backups', 'Security audits'],
            answer: 1,
            why: 'K8s is an orchestrator: it decides where containers run, restarts them, scales them, and gives them stable network identities — at scale, across many machines.' },
        ]
      },
    ]
  },

  // ========================================================================
  // 4. SYSTEM DESIGN
  // ========================================================================
  {
    id: 'system',
    title: 'System Design',
    icon: 'SD',
    color: 'var(--c-system)',
    desc: 'How to design large systems that handle millions of users without falling over.',
    lessons: [
      {
        id: 'system-design-intro',
        title: 'The System Design Mindset',
        desc: 'System design interviews are open-ended conversations. Here\'s how to think during them — and at work.',
        blocks: [
          { type: 'text', html: `
            <p>System design = picking the right pieces (databases, caches, queues, services) and arranging them to meet specific requirements (scale, latency, cost, reliability).</p>
            <h3>The interview rhythm</h3>
            <ol>
              <li><strong>Clarify requirements.</strong> "What features? How many users? Read-heavy or write-heavy?"</li>
              <li><strong>Estimate scale.</strong> Back-of-envelope numbers. (1M users × 5 posts/day = 50 posts/sec)</li>
              <li><strong>Sketch the data model.</strong> What entities? What relationships?</li>
              <li><strong>Draw the high-level architecture.</strong> Client → API → DB. Add a cache, a CDN, a queue as needed.</li>
              <li><strong>Deep-dive 1-2 components.</strong> "Let's design the URL shortener's hash generation."</li>
              <li><strong>Discuss trade-offs and bottlenecks.</strong> What breaks first at 100x scale?</li>
            </ol>
            <p>The interviewer doesn't want a perfect answer. They want to see how you think.</p>
          ` },
          { type: 'callout', tone: 'tip', label: 'Numbers to memorize', html: `
            L1 cache: ~1 ns · RAM: ~100 ns · SSD random read: ~150 µs · Round trip in same datacenter: ~500 µs · Round trip cross-continent: ~150 ms.
          ` },
          { type: 'quiz',
            q: 'In a system design interview, what should you do FIRST?',
            options: ['Start drawing boxes', 'Ask clarifying questions about requirements and scale', 'Pick a database', 'Talk about microservices'],
            answer: 1,
            why: 'Without requirements, you can\'t design anything. The first 5 minutes of any system design interview should be requirements gathering and scale estimation.' },
        ]
      },
      {
        id: 'scaling',
        title: 'Scaling: Vertical vs Horizontal',
        desc: 'Two ways to handle more traffic. Knowing when to use which is half of system design.',
        blocks: [
          { type: 'text', html: `
            <h3>Vertical scaling — buy a bigger machine</h3>
            <p>More CPU, more RAM, faster disk on a single server.</p>
            <ul>
              <li>✅ Simple. No code changes needed.</li>
              <li>❌ There's a ceiling. The biggest VM in the world still crashes if it dies.</li>
              <li>❌ Single point of failure.</li>
            </ul>
            <h3>Horizontal scaling — add more machines</h3>
            <p>Run many copies of the app behind a load balancer.</p>
            <ul>
              <li>✅ Effectively infinite scale</li>
              <li>✅ One crashes, others keep serving</li>
              <li>❌ Your app must be <strong>stateless</strong> — no in-memory user sessions, no local file storage</li>
              <li>❌ The database becomes the bottleneck</li>
            </ul>
            <p>Real systems do <strong>both</strong>: vertical for the database (it's hard to shard), horizontal for the stateless app servers.</p>
          ` },
          { type: 'text', html: `
            <h3>The 5 standard scaling moves</h3>
            <ol>
              <li><strong>Add a CDN</strong> — serve static files from edges close to users.</li>
              <li><strong>Add caching</strong> — Redis in front of the database.</li>
              <li><strong>Add read replicas</strong> — multiple DB copies for reads, one for writes.</li>
              <li><strong>Add a queue</strong> — push slow work (emails, image processing) off the request path.</li>
              <li><strong>Shard the database</strong> — split data across multiple DBs by user_id ranges (last resort, very painful).</li>
            </ol>
          ` },
          { type: 'quiz',
            q: 'Your app is slow because the database can\'t keep up with reads. What\'s usually the first thing to try?',
            options: ['Switch to NoSQL', 'Add a Redis cache in front of the database', 'Buy a faster CPU for the app server', 'Rewrite in Rust'],
            answer: 1,
            why: 'A cache absorbs read traffic so the DB only sees the misses. Redis can serve millions of reads/sec. It\'s the highest-leverage scaling move.' },
        ]
      },
      {
        id: 'caching',
        title: 'Caching Strategies',
        desc: 'Caching is the single most powerful performance lever. Misuse it and you\'ll ship subtle bugs.',
        blocks: [
          { type: 'text', html: `
            <p>A cache stores results so you don't re-compute them. The challenge isn't caching — it's <strong>invalidating</strong> the cache when data changes.</p>
            <blockquote style="border-left: 3px solid var(--accent); padding-left: 16px; color: var(--text-dim); font-style: italic;">"There are only two hard things in computer science: cache invalidation and naming things." — Phil Karlton</blockquote>
            <h3>Where to cache</h3>
            <ul>
              <li><strong>Browser cache</strong> — HTML, CSS, JS, images cached on the user's machine</li>
              <li><strong>CDN</strong> — cached at the edge near users</li>
              <li><strong>Application cache</strong> — Redis/Memcached between app and DB</li>
              <li><strong>Database query cache</strong> — internal to the DB</li>
            </ul>
            <h3>Cache strategies</h3>
            <ul>
              <li><strong>Cache-aside</strong> (most common): App checks cache → if miss, query DB → write to cache.</li>
              <li><strong>Write-through</strong>: Every write goes to both DB and cache. Slower writes, consistent reads.</li>
              <li><strong>Write-behind</strong>: Write to cache, async-flush to DB. Fast but can lose data.</li>
              <li><strong>TTL (time-to-live)</strong>: Auto-expire entries after N seconds. Simple, accepts some staleness.</li>
            </ul>
          ` },
          { type: 'code', lang: 'js', code: `async function getUser(id) {
  const cacheKey = \`user:\${id}\`;
  
  // 1. Try cache
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  // 2. Miss — go to DB
  const user = await db.users.findById(id);
  
  // 3. Populate cache for next time (5 min TTL)
  await redis.set(cacheKey, JSON.stringify(user), 'EX', 300);
  
  return user;
}` },
          { type: 'quiz',
            q: 'Which is the famous "two hard things in computer science"?',
            options: ['Math and physics', 'Cache invalidation and naming things', 'Concurrency and recursion', 'Hardware and software'],
            answer: 1,
            why: 'Phil Karlton\'s famous quote. Both problems sound trivial but bite even senior engineers constantly.' },
        ]
      },
      {
        id: 'load-balancing',
        title: 'Load Balancing',
        desc: 'How to spread incoming traffic across many servers — and what happens when one dies.',
        blocks: [
          { type: 'text', html: `
            <p>A <strong>load balancer (LB)</strong> sits in front of your app servers. Requests hit the LB, which forwards each one to a healthy server based on some strategy.</p>
            <h3>Common strategies</h3>
            <ul>
              <li><strong>Round-robin</strong> — server 1, 2, 3, 1, 2, 3...</li>
              <li><strong>Least connections</strong> — pick the server currently handling the fewest requests</li>
              <li><strong>Hash-based</strong> — same user always lands on the same server (e.g. for sticky sessions)</li>
            </ul>
            <h3>Health checks</h3>
            <p>The LB pings each server every few seconds. If a server stops responding, it's removed from rotation. When it recovers, it's added back.</p>
            <h3>Layer 4 vs Layer 7</h3>
            <ul>
              <li><strong>Layer 4 LB</strong> — works at the TCP level. Fast but blind to the request content.</li>
              <li><strong>Layer 7 LB</strong> — works at HTTP. Can route by URL, headers, etc. Slower but smart. Most modern LBs (nginx, AWS ALB, Cloudflare) are L7.</li>
            </ul>
          ` },
          { type: 'callout', tone: 'tip', label: 'In practice', html: `Cloud providers give you load balancers as a service: <strong>AWS ALB</strong>, <strong>Cloud Load Balancer (GCP)</strong>, <strong>Azure Load Balancer</strong>. You don't have to run nginx yourself unless you want to.` },
          { type: 'quiz',
            q: 'You have 3 app servers behind a load balancer. One server crashes. What should happen?',
            options: ['All requests fail', 'The load balancer\'s health check detects the failure and routes traffic only to the healthy 2', 'Users see a 500 error until you manually fix it', 'The other two servers also crash'],
            answer: 1,
            why: 'Health checks are the LB\'s superpower. They detect failures within seconds and re-route automatically. Users see no impact (assuming you have spare capacity).' },
        ]
      },
      {
        id: 'design-twitter',
        title: 'Mini Case Study: Design "Twitter for Cats"',
        desc: 'Let\'s design a real system using everything you\'ve learned. Watch how the pieces snap together.',
        blocks: [
          { type: 'text', html: `
            <p>Requirements:</p>
            <ul>
              <li>Users post short text "meows" (≤ 280 chars)</li>
              <li>Users follow other cats</li>
              <li>Each user sees a feed of meows from cats they follow</li>
              <li>10M users, ~100M meows/day</li>
            </ul>
            <h3>Step 1 — Data model</h3>
            <ul>
              <li><code>users(id, handle, name, created_at)</code></li>
              <li><code>meows(id, user_id, text, created_at)</code></li>
              <li><code>follows(follower_id, followee_id)</code></li>
            </ul>
            <h3>Step 2 — High-level architecture</h3>
            <p>Client (mobile/web) → CDN → Load Balancer → API servers (stateless, horizontally scaled) → PostgreSQL (writes) + read replicas (reads) + Redis cache (hot data).</p>
            <h3>Step 3 — The hard part: the feed</h3>
            <p>Two strategies, both used in real life:</p>
            <ul>
              <li><strong>Pull (fan-out on read)</strong> — when a user opens their feed, query <code>SELECT * FROM meows WHERE user_id IN (followed_ids) ORDER BY created_at DESC LIMIT 50</code>. Simple, but slow for users following thousands.</li>
              <li><strong>Push (fan-out on write)</strong> — every time someone meows, write a copy of the meow to each follower's pre-built feed in Redis. Fast reads, expensive writes (especially for celebrity cats with millions of followers).</li>
              <li><strong>Hybrid</strong> — push for normal users, pull for celebrities. Real Twitter does this.</li>
            </ul>
            <h3>Step 4 — Background work</h3>
            <p>Use a queue (SQS / Kafka) for slow async work: notification fan-out, image resizing, search indexing.</p>
          ` },
          { type: 'callout', tone: 'tip', label: 'The takeaway', html: `Most real systems are this same set of LEGO blocks (CDN, LB, app servers, DB + replicas, cache, queue) reconfigured. Once you've designed Twitter, designing Instagram or TikTok feels like rearranging the same pieces.` },
          { type: 'quiz',
            q: 'In the "fan-out on write" feed strategy, what\'s the main downside?',
            options: ['Reads are slow', 'A single celebrity post triggers writes to millions of follower feeds — expensive', 'It doesn\'t work', 'It needs a special database'],
            answer: 1,
            why: 'Fan-out on write is fast for readers but punishes writes when one user has many followers. Hybrid approaches handle this asymmetry.' },
        ]
      },
    ]
  },

  // ========================================================================
  // 5. POSITIONING
  // ========================================================================
  {
    id: 'positioning',
    title: 'Positioning',
    icon: '⚡',
    color: 'var(--c-positioning)',
    desc: 'How to stand out in a sea of developers. Portfolio, presence, and signal.',
    lessons: [
      {
        id: 'why-positioning',
        title: 'Skills Are Not Enough',
        desc: 'There are millions of developers. The ones who get noticed have figured out positioning.',
        blocks: [
          { type: 'text', html: `
            <p>You can be a brilliant engineer and still get ignored. The market doesn't reward skill — it rewards <strong>visible, legible</strong> skill. Positioning is the bridge.</p>
            <h3>The four levers</h3>
            <ul>
              <li><strong>Niche</strong> — what specific problem do you solve? "Full-stack dev" is invisible. "I help fintech startups ship payment infra in 30 days" is not.</li>
              <li><strong>Proof</strong> — projects, GitHub, writing, talks. Things people can click and read.</li>
              <li><strong>Network</strong> — who knows you exist and respects your work.</li>
              <li><strong>Signal</strong> — your bio, profile, commits, and posts all telling the same story.</li>
            </ul>
          ` },
          { type: 'callout', tone: 'tip', label: 'The harsh truth', html: `Most jobs are filled before they're posted. Recruiters and hiring managers reach out to people they've heard of. Positioning is what makes them hear of you.` },
          { type: 'quiz',
            q: 'According to this lesson, what makes a developer "visible" in the market?',
            options: ['Having the highest salary', 'A specific niche, public proof, a network, and consistent signal', 'Working at a famous company', 'Writing the most code'],
            answer: 1,
            why: 'These four levers (niche + proof + network + signal) are what turn anonymous skill into reachable career opportunity.' },
        ]
      },
      {
        id: 'github-portfolio',
        title: 'A GitHub That Sells For You',
        desc: 'Your GitHub is your real resume. Most devs leave it as a mess. Here\'s how to make it your best asset.',
        blocks: [
          { type: 'text', html: `
            <h3>The 4-project portfolio</h3>
            <p>You don't need 30 projects. You need <strong>3-4 polished ones</strong> that show range:</p>
            <ol>
              <li><strong>A real-world full-stack app</strong> — frontend + backend + database, deployed live with a real URL.</li>
              <li><strong>A tool you actually use</strong> — a CLI, a script, an extension. Shows you scratch your own itch.</li>
              <li><strong>A contribution to an open-source project</strong> — even a small bug fix or doc improvement. Shows you can navigate someone else's code.</li>
              <li><strong>A "hard tech" project</strong> — anything technically meaty: a small interpreter, a graphics demo, an ML model, a game engine. Signals depth.</li>
            </ol>
            <h3>Each repo must have</h3>
            <ul>
              <li>A clear, screenshot-rich README explaining <em>what it does, why, how to run it</em></li>
              <li>A live demo link (Vercel/Netlify/Render — all free)</li>
              <li>Clean commit history (no <code>"updates"</code> messages)</li>
              <li>Tests, even just a few</li>
              <li>A descriptive repo name. <code>my-app</code> is invisible. <code>budget-buddy-personal-finance-tracker</code> shows up in searches.</li>
            </ul>
          ` },
          { type: 'callout', tone: 'tip', label: 'Profile README', html: `Create a repo with the same name as your username — its README becomes your GitHub profile page. Use it to pin who you are, what you build, and your best work.` },
          { type: 'quiz',
            q: 'Should you have 30+ small repos on your GitHub to look prolific?',
            options: ['Yes, more is always better', 'No — 3-4 polished projects with READMEs and live demos beats 30 abandoned ones', 'It doesn\'t matter, no one looks', 'Only if they\'re all in JavaScript'],
            answer: 1,
            why: 'Quality over quantity. Hiring managers spend ~30 seconds on your GitHub. They\'ll click ONE pinned project. Make it count.' },
        ]
      },
      {
        id: 'building-in-public',
        title: 'Building in Public',
        desc: 'The single most underrated career move in tech: write about what you build.',
        blocks: [
          { type: 'text', html: `
            <p>Most developers learn things and forget them. The few who <em>write down</em> what they learn build a permanent compounding asset.</p>
            <h3>Why writing works</h3>
            <ul>
              <li>It forces you to actually understand things (you can't bullshit a blog post)</li>
              <li>It makes you discoverable on Google for years</li>
              <li>It creates artifacts you can link in interviews, applications, DMs</li>
              <li>It's the cheapest way to build a network — people DM the authors of stuff they liked</li>
            </ul>
            <h3>What to write</h3>
            <ul>
              <li><strong>Build logs</strong> — "How I built X in a weekend"</li>
              <li><strong>Bugs you debugged</strong> — "Why my Postgres queries got 100x slower at 3am"</li>
              <li><strong>Things you learned</strong> — "A clear explanation of [confusing topic] for my past self"</li>
              <li><strong>Contrarian takes</strong> — "Why I stopped using microservices"</li>
            </ul>
            <h3>Where</h3>
            <p>A simple personal site (built by you — extra signal). Cross-post to <strong>Hacker News</strong>, <strong>dev.to</strong>, <strong>Reddit r/programming</strong>, <strong>X/Twitter</strong>. One viral post a year compounds for a decade.</p>
          ` },
          { type: 'callout', tone: 'tip', label: 'The 1-post rule', html: `Most devs never write a single technical post. Just one good post puts you ahead of 95% of the field. Aim for one a month.` },
          { type: 'quiz',
            q: 'What\'s the MAIN reason writing about your work helps your career?',
            options: ['Companies pay you per word', 'It builds a permanent, discoverable, linkable record of your thinking that compounds over time', 'It\'s required for promotions', 'It replaces having a job'],
            answer: 1,
            why: 'Writing creates leverage. One blog post can be read by 10,000 people while you sleep — for years. That\'s impossible to match through 1:1 networking.' },
        ]
      },
      {
        id: 'interview-prep',
        title: 'The Interview Game',
        desc: 'Tech interviews are their own skill — separate from your job skills. Treat them that way.',
        blocks: [
          { type: 'text', html: `
            <p>The dirty secret: being a great engineer is necessary but not sufficient. You also need to be a great <em>interviewer</em>. Different skill. Trainable.</p>
            <h3>The 4 rounds you'll face</h3>
            <ol>
              <li><strong>Phone/recruiter screen</strong> — culture fit, basic logistics. Don't bomb it.</li>
              <li><strong>Coding (LeetCode-style)</strong> — solve algorithm problems live. The most hated round, but the most predictable.</li>
              <li><strong>System design</strong> — design Twitter, Uber, etc. Senior+ only.</li>
              <li><strong>Behavioral</strong> — "Tell me about a time you disagreed with your manager." Use the STAR framework (Situation, Task, Action, Result).</li>
            </ol>
            <h3>Coding interview prep — the no-BS plan</h3>
            <ul>
              <li>Use <strong>NeetCode 150</strong> (free curated list of the most common patterns). Solve all 150 over 2-3 months.</li>
              <li>Don't grind randomly. Patterns repeat. Recognize: two-pointer, sliding window, BFS/DFS, dynamic programming, recursion, binary search.</li>
              <li>Practice <strong>talking out loud</strong> while solving. The interview is as much about communication as code.</li>
              <li>Mock interviews with friends or <strong>Pramp / Interviewing.io</strong>.</li>
            </ul>
            <h3>System design prep</h3>
            <ul>
              <li>Read <strong>"System Design Interview" by Alex Xu</strong> (volumes 1 & 2)</li>
              <li>Watch ByteByteGo, Hello Interview on YouTube</li>
              <li>Practice 10 classic designs: Twitter, Instagram, Uber, Netflix, URL shortener, distributed cache, search autocomplete, payment system, news feed, chat app</li>
            </ul>
          ` },
          { type: 'callout', tone: 'warn', label: 'The truth about LeetCode', html: `It's mostly a fake test that doesn't reflect daily work. But it's the test that pays $200K+ jobs. Learn the meta-game and move on.` },
          { type: 'quiz',
            q: 'For coding interview prep, what\'s the smartest approach?',
            options: ['Solve 1000 random LeetCode problems', 'Learn ~10 underlying patterns that cover the vast majority of questions, via something like NeetCode 150', 'Memorize answers from Glassdoor', 'Skip it and hope for the best'],
            answer: 1,
            why: 'Pattern recognition beats brute force. Most LeetCode problems are variants of ~10 patterns. Recognize the pattern → solve quickly.' },
          { type: 'text', html: `<h3>Two classic interview problems — solve them now</h3><p>"Two Sum" and "Valid Parentheses" are two of the most common patterns asked at FAANG. They show up in literally hundreds of interviews. Solve them here, then you've seen them.</p>` },
          { type: 'challenge', challengeId: 'two-sum' },
          { type: 'challenge', challengeId: 'valid-parens' },
        ]
      },
    ]
  },

  // ========================================================================
  // 6. SIX-FIGURE ROLES
  // ========================================================================
  {
    id: 'roles',
    title: 'Six-Figure Roles',
    icon: '$',
    color: 'var(--c-roles)',
    desc: 'The actual jobs that pay $100K-$500K, where to find them, and how to negotiate.',
    lessons: [
      {
        id: 'role-map',
        title: 'The Career Ladder',
        desc: 'Where a full-stack developer can go in 1, 5, and 10 years.',
        blocks: [
          { type: 'text', html: `
            <h3>The classic IC (individual contributor) ladder</h3>
            <ul>
              <li><strong>Junior / Associate SWE</strong> — first 0-2 years. $80-130K (US). You\'re paid to learn.</li>
              <li><strong>Mid-level SWE</strong> — 2-5 years. $130-200K. You ship features independently.</li>
              <li><strong>Senior SWE</strong> — 5+ years. $200-350K. You own systems and mentor others. <em>This is where most careers plateau.</em></li>
              <li><strong>Staff SWE</strong> — $300-500K+. You influence multiple teams. Cross-team architecture.</li>
              <li><strong>Principal / Distinguished</strong> — $500K-$1M+. Set technical direction for the entire company.</li>
            </ul>
            <h3>The management track</h3>
            <ul>
              <li><strong>Tech Lead</strong> — senior IC who runs a team\'s technical agenda</li>
              <li><strong>Engineering Manager</strong> — people management, less code</li>
              <li><strong>Director / VP Eng / CTO</strong> — leadership, strategy, hiring</li>
            </ul>
            <h3>Other "exit" paths</h3>
            <ul>
              <li><strong>Startup founder</strong> — high risk, high upside</li>
              <li><strong>Indie hacker</strong> — small SaaS, $10-100K MRR with no employees</li>
              <li><strong>Consultant / contractor</strong> — $150-400+/hr</li>
              <li><strong>Devrel / DevTools</strong> — engineering + writing/speaking</li>
            </ul>
          ` },
          { type: 'callout', tone: 'tip', label: 'The Senior plateau', html: `~70% of devs stop at Senior. Not because they can't go further, but because Staff+ requires a different skill set: communication, scope, influence. Build those muscles deliberately.` },
          { type: 'quiz',
            q: 'What\'s the typical jump in skills from Senior to Staff engineer?',
            options: ['Knowing more languages', 'Influence across multiple teams; not just code, but technical strategy and communication', 'Working faster', 'Memorizing more LeetCode'],
            answer: 1,
            why: 'Staff is about scope and leverage, not raw output. You\'re evaluated on what your work makes OTHERS able to do.' },
        ]
      },
      {
        id: 'where-to-apply',
        title: 'Where the Money Actually Is',
        desc: 'Not all companies pay equally. Here\'s the landscape.',
        blocks: [
          { type: 'text', html: `
            <h3>Compensation tiers (US, 2026)</h3>
            <ul>
              <li><strong>FAANG+</strong> (Google, Meta, Apple, Amazon, Netflix, Microsoft, Stripe, OpenAI, Anthropic) — Senior SWE: <strong>$350-700K</strong> total comp. Highest cash + stock, hardest interviews.</li>
              <li><strong>Top startups</strong> (well-funded series B-D) — Senior SWE: $200-350K + meaningful equity. Higher upside, more risk.</li>
              <li><strong>Non-tech Fortune 500</strong> — Senior SWE: $150-250K. Stable, lower ceiling, easier interviews.</li>
              <li><strong>Remote-first companies</strong> (GitLab, Zapier, Automattic) — $150-300K, often globally distributed.</li>
              <li><strong>Consulting / contracting</strong> — $80-300+/hr depending on niche.</li>
            </ul>
            <h3>Where to find the jobs</h3>
            <ul>
              <li><strong>levels.fyi</strong> — research salary ranges per company, per level, per location. Required reading.</li>
              <li><strong>Direct on company sites</strong> — best response rates</li>
              <li><strong>LinkedIn</strong> — set up "Open to Work" + apply directly</li>
              <li><strong>Wellfound</strong> (formerly AngelList) — startup jobs</li>
              <li><strong>Hacker News "Who is hiring?"</strong> (first of every month) — high signal startups</li>
              <li><strong>Recruiters</strong> — let them do the work for you, especially in tech hubs</li>
            </ul>
          ` },
          { type: 'callout', tone: 'tip', label: 'The job-search math', html: `Apply to 30 jobs, expect ~5 responses, ~2 interviews, ~1 offer. The numbers are brutal. Don\'t take rejection personally — it\'s mostly noise.` },
          { type: 'quiz',
            q: 'Which website is the best resource for researching what specific companies pay specific roles?',
            options: ['Glassdoor', 'levels.fyi', 'Indeed', 'Reddit'],
            answer: 1,
            why: 'levels.fyi has the most accurate, granular data on tech compensation — broken down by company, level, location, and total comp components.' },
        ]
      },
      {
        id: 'negotiate',
        title: 'How to Negotiate Your Offer',
        desc: 'A 30-minute conversation can earn you $30-100K extra over a year. Don\'t skip it.',
        blocks: [
          { type: 'text', html: `
            <p>Almost every offer is negotiable. Recruiters expect you to negotiate. Not negotiating signals you don't know your worth.</p>
            <h3>The 5 rules</h3>
            <ol>
              <li><strong>Always have multiple offers (or be interviewing).</strong> Leverage is everything.</li>
              <li><strong>Never give a number first.</strong> "What's your range for this role?" > "I'm looking for $X."</li>
              <li><strong>Negotiate the whole package</strong> — base, sign-on bonus, equity, annual bonus, vacation, relocation, remote flexibility.</li>
              <li><strong>Ask for time.</strong> "Thanks, can I get back to you by Friday?" Never accept on the call.</li>
              <li><strong>Be polite but firm.</strong> "Based on my offers from X and Y, I was hoping for closer to $Z. Can you make that work?"</li>
            </ol>
            <h3>What's actually negotiable</h3>
            <ul>
              <li><strong>Base salary</strong> — usually 5-15% room</li>
              <li><strong>Sign-on bonus</strong> — often the easiest lever (one-time cost to them)</li>
              <li><strong>Equity grant</strong> — at startups especially, can move a lot</li>
              <li><strong>Equity refresh schedule</strong> — annual top-ups</li>
              <li><strong>Title / level</strong> — surprisingly negotiable, with huge long-term comp impact</li>
              <li><strong>Start date</strong> — buy yourself time off between jobs</li>
            </ul>
          ` },
          { type: 'callout', tone: 'warn', label: 'The trap', html: `Recruiters will ask "what are you currently making?" or "what are your expectations?" early. Deflect with "I'd want to learn more about the role first" or "I'm focused on finding the right fit; I trust you'll bring me a competitive offer." Anchoring low here costs you 6 figures over a career.` },
          { type: 'quiz',
            q: 'A recruiter asks for your salary expectations on the first call. Best response?',
            options: ['Give a low number to seem reasonable', 'Give a high number to set the anchor', 'Deflect — "I\'d like to learn more about the role first; I\'m sure we can find a fair number once we both know it\'s a fit"', 'Lie about your current salary'],
            answer: 2,
            why: 'Whoever names a number first loses leverage. Politely deflect until you have an offer in hand or a clear band from them.' },
        ]
      },
      {
        id: 'final-roadmap',
        title: 'Your 12-Month Roadmap',
        desc: 'A concrete, week-by-week plan to go from zero to your first six-figure offer.',
        blocks: [
          { type: 'text', html: `
            <h3>Months 1-3: Foundations</h3>
            <ul>
              <li>Daily: 1-2 hrs of JavaScript fundamentals (this app, freeCodeCamp, MDN)</li>
              <li>Build 3 small projects: a to-do app, a weather app, a small game</li>
              <li>Set up GitHub. Commit daily. Even 1 line counts.</li>
              <li>Learn Git deeply. Read <em>Pro Git</em> (free online).</li>
            </ul>
            <h3>Months 4-6: Full-stack</h3>
            <ul>
              <li>Pick one frontend framework (<strong>React</strong>) and one backend (<strong>Node.js + Express</strong> or <strong>Next.js</strong> for both)</li>
              <li>Learn PostgreSQL basics + an ORM (Prisma)</li>
              <li>Build 1 substantial full-stack project. Deploy it. Give it a real domain.</li>
              <li>Start a tech blog. Write 1 post per month about what you\'re building.</li>
            </ul>
            <h3>Months 7-9: Scale up & specialize</h3>
            <ul>
              <li>Learn Docker. Containerize your projects.</li>
              <li>Pick a cloud (AWS) and learn the 8 essential services.</li>
              <li>Add tests to your projects. Set up a CI pipeline.</li>
              <li>Contribute to an open-source project (start with a typo PR if needed).</li>
              <li>Pick a niche: AI/ML? DevTools? Fintech? Specialization beats generalization in job searches.</li>
            </ul>
            <h3>Months 10-12: The job hunt</h3>
            <ul>
              <li>Polish: GitHub README, personal site, LinkedIn, resume.</li>
              <li>System design study: Alex Xu book + ByteByteGo + 10 classic designs</li>
              <li>NeetCode 150 — at least 75 problems</li>
              <li>Mock interviews 2x/week (Pramp, friends)</li>
              <li>Apply to 20-50 jobs. Use referrals where possible.</li>
              <li>Negotiate every offer. Pick the best fit.</li>
            </ul>
          ` },
          { type: 'callout', tone: 'tip', label: 'The honest truth', html: `Some people do this in 6 months. Some take 2 years. The variable isn't talent — it's <strong>consistency</strong>. 1 hour a day for 12 months crushes 8 hours a day for 2 weeks then nothing. <strong>Show up daily.</strong>` },
          { type: 'text', html: `
            <h3>You did it.</h3>
            <p>If you got through this curriculum and built things along the way, you have a working knowledge of the entire full-stack picture. That is rare. Most people quit at Foundation.</p>
            <p>Now go build something. Ship it. Show the world. Repeat.</p>
            <p>— SWE Academy</p>
          ` },
          { type: 'quiz',
            q: 'According to this roadmap, what matters most for actually finishing the journey?',
            options: ['Innate talent', 'Daily consistency over a long time, beats sporadic intense effort', 'Going to a top university', 'Knowing the right people first'],
            answer: 1,
            why: 'Consistency compounds. The dev who codes 1 hour a day for a year ends up far ahead of the one who binges and burns out.' },
        ]
      },
    ]
  },
];

// Expose globally
window.CURRICULUM = CURRICULUM;
