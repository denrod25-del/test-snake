// Build-along projects.
// Each project has a sequence of steps, each rendered like a lesson.
// Steps reuse existing block types (text, code, htmlplay, play, etc.).

const PROJECTS = [
  {
    id: 'todo-app',
    title: 'Project 1 — A Real To-Do App (HTML + CSS + JS)',
    desc: 'In about an hour you\'ll build, with your own hands, a fully working to-do app: add tasks, mark them complete, delete them, and persist them across page reloads. Works in the browser, no backend needed.',
    icon: '📝',
    color: '#5eead4',
    steps: [
      {
        id: 'p1-step-1',
        title: 'Step 1 — The HTML skeleton',
        blocks: [
          { type: 'text', html: `
            <p>Every web page starts as plain HTML. Let's lay out our app's structure: a heading, an input box + button, and an empty list.</p>
            <p>Below is a live HTML/CSS playground. Edit the left side and watch the right side update.</p>
          ` },
          { type: 'htmlplay', starter: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: system-ui; padding: 2rem; }
    h1 { color: #6d28d9; }
    input { padding: 8px; font-size: 16px; }
    button { padding: 8px 16px; font-size: 16px; }
  </style>
</head>
<body>
  <h1>My To-Do List</h1>
  <input id="task" placeholder="What do you need to do?" />
  <button>Add</button>
  <ul id="list"></ul>
</body>
</html>` },
          { type: 'callout', tone: 'tip', label: 'What you just did', html: `You created a <strong>document structure</strong>. The HTML element tree is the foundation everything else builds on. Your browser parses this top-to-bottom and constructs a tree of nodes (the DOM) that JavaScript can read and modify.` },
        ]
      },
      {
        id: 'p1-step-2',
        title: 'Step 2 — Style it like a real app',
        blocks: [
          { type: 'text', html: `<p>Now let's make it actually look nice with CSS. We'll add spacing, colors, hover effects, and rounded corners.</p>` },
          { type: 'htmlplay', starter: `<!DOCTYPE html>
<html>
<head>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: system-ui;
      background: linear-gradient(135deg, #1e1b4b, #312e81);
      color: white;
      max-width: 480px;
      margin: 0 auto;
      padding: 3rem 1.5rem;
      min-height: 100vh;
    }
    h1 { font-size: 28px; margin-bottom: 1.5rem; }
    .row { display: flex; gap: 8px; margin-bottom: 1.5rem; }
    input {
      flex: 1; padding: 10px 14px; font-size: 16px;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      color: white; border-radius: 8px;
      outline: none;
    }
    input::placeholder { color: rgba(255,255,255,0.4); }
    button {
      background: #7c3aed; color: white; border: none;
      padding: 10px 20px; font-size: 16px;
      border-radius: 8px; cursor: pointer;
      font-weight: 600;
    }
    button:hover { background: #6d28d9; }
    ul { list-style: none; padding: 0; }
    li {
      background: rgba(255,255,255,0.06);
      padding: 12px 16px; margin-bottom: 8px;
      border-radius: 8px;
    }
  </style>
</head>
<body>
  <h1>📝 My To-Do List</h1>
  <div class="row">
    <input id="task" placeholder="What do you need to do?" />
    <button>Add</button>
  </div>
  <ul id="list">
    <li>Buy groceries</li>
    <li>Learn JavaScript</li>
    <li>Build a cool app</li>
  </ul>
</body>
</html>` },
          { type: 'callout', tone: 'tip', label: 'Try it', html: `Change the gradient colors. Make the button orange. Try <code>border-radius: 50px;</code> on <code>li</code>. Tweaking is the best way to learn CSS.` },
        ]
      },
      {
        id: 'p1-step-3',
        title: 'Step 3 — Make the button actually work',
        blocks: [
          { type: 'text', html: `<p>Now the JavaScript! When the user clicks "Add", we need to:</p>
          <ol>
            <li>Read the input value</li>
            <li>Create a new <code>&lt;li&gt;</code> element</li>
            <li>Append it to the list</li>
            <li>Clear the input</li>
          </ol>` },
          { type: 'htmlplay', starter: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: system-ui; padding: 2rem; max-width: 480px; margin: 0 auto; background: #1e1b4b; color: white; }
    .row { display: flex; gap: 8px; margin-bottom: 1rem; }
    input { flex: 1; padding: 10px; font-size: 16px; border-radius: 6px; border: 1px solid #555; background: rgba(255,255,255,0.1); color: white; }
    button { background: #7c3aed; color: white; border: none; padding: 10px 18px; border-radius: 6px; cursor: pointer; }
    li { background: rgba(255,255,255,0.06); padding: 10px 14px; margin: 6px 0; border-radius: 6px; list-style: none; }
  </style>
</head>
<body>
  <h1>📝 To-Do</h1>
  <div class="row">
    <input id="task" placeholder="New task..." />
    <button id="addBtn">Add</button>
  </div>
  <ul id="list"></ul>

  <script>
    const input = document.getElementById('task');
    const list = document.getElementById('list');
    const button = document.getElementById('addBtn');

    button.addEventListener('click', () => {
      const text = input.value.trim();
      if (!text) return;             // ignore empty
      const li = document.createElement('li');
      li.textContent = text;
      list.appendChild(li);
      input.value = '';              // clear the input
      input.focus();
    });

    // Bonus: pressing Enter also adds.
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') button.click();
    });
  </script>
</body>
</html>` },
          { type: 'callout', tone: 'tip', label: 'What just happened', html: `You wired up <strong>events</strong> — <code>addEventListener</code> tells the browser "when this thing happens, run this function." That's the entire interactive web in a nutshell.` },
        ]
      },
      {
        id: 'p1-step-4',
        title: 'Step 4 — Mark complete & delete',
        blocks: [
          { type: 'text', html: `<p>A real to-do app lets you check things off and remove them. Let's add a checkbox and a delete button to each task.</p>` },
          { type: 'htmlplay', starter: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: system-ui; padding: 2rem; max-width: 520px; margin: 0 auto; background: #1e1b4b; color: white; }
    .row { display: flex; gap: 8px; margin-bottom: 1rem; }
    input[type=text] { flex: 1; padding: 10px; font-size: 16px; border-radius: 6px; border: 1px solid #555; background: rgba(255,255,255,0.1); color: white; }
    button { background: #7c3aed; color: white; border: none; padding: 10px 18px; border-radius: 6px; cursor: pointer; }
    .del-btn { background: #ef4444; padding: 4px 10px; }
    li {
      display: flex; align-items: center; gap: 10px;
      background: rgba(255,255,255,0.06);
      padding: 10px 14px; margin: 6px 0; border-radius: 6px;
      list-style: none;
    }
    li.done span { text-decoration: line-through; opacity: 0.5; }
    li span { flex: 1; }
  </style>
</head>
<body>
  <h1>📝 To-Do</h1>
  <div class="row">
    <input id="task" type="text" placeholder="New task..." />
    <button id="addBtn">Add</button>
  </div>
  <ul id="list"></ul>

  <script>
    const input = document.getElementById('task');
    const list = document.getElementById('list');

    function addTask(text) {
      const li = document.createElement('li');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.addEventListener('change', () => {
        li.classList.toggle('done', checkbox.checked);
      });

      const span = document.createElement('span');
      span.textContent = text;

      const del = document.createElement('button');
      del.textContent = '✕';
      del.className = 'del-btn';
      del.addEventListener('click', () => li.remove());

      li.append(checkbox, span, del);
      list.appendChild(li);
    }

    document.getElementById('addBtn').addEventListener('click', () => {
      const text = input.value.trim();
      if (!text) return;
      addTask(text);
      input.value = '';
      input.focus();
    });

    input.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('addBtn').click(); });

    // Pre-load some examples
    addTask('Finish lesson 4');
    addTask('Stretch for 5 minutes');
  </script>
</body>
</html>` },
          { type: 'callout', tone: 'tip', label: 'Next big idea', html: `Notice how each task is a <em>component</em> — we built it with one function, <code>addTask</code>. This is the seed of how every modern UI framework (React, Vue, Svelte) works: build small reusable pieces and compose them.` },
        ]
      },
      {
        id: 'p1-step-5',
        title: 'Step 5 — Persist tasks across reloads (localStorage)',
        blocks: [
          { type: 'text', html: `<p>Right now, refreshing the page wipes everything. Real apps remember. We'll use the browser's built-in <strong>localStorage</strong> — a tiny key-value store that survives reloads.</p>` },
          { type: 'htmlplay', starter: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: system-ui; padding: 2rem; max-width: 520px; margin: 0 auto; background: #1e1b4b; color: white; }
    .row { display: flex; gap: 8px; margin-bottom: 1rem; }
    input[type=text] { flex: 1; padding: 10px; font-size: 16px; border-radius: 6px; border: 1px solid #555; background: rgba(255,255,255,0.1); color: white; }
    button { background: #7c3aed; color: white; border: none; padding: 10px 18px; border-radius: 6px; cursor: pointer; }
    .del-btn { background: #ef4444; padding: 4px 10px; }
    li { display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.06); padding: 10px 14px; margin: 6px 0; border-radius: 6px; list-style: none; }
    li.done span { text-decoration: line-through; opacity: 0.5; }
    li span { flex: 1; }
  </style>
</head>
<body>
  <h1>📝 To-Do (with memory!)</h1>
  <div class="row">
    <input id="task" type="text" placeholder="New task..." />
    <button id="addBtn">Add</button>
  </div>
  <ul id="list"></ul>

  <script>
    const KEY = 'swe-todo-app';
    let tasks = JSON.parse(localStorage.getItem(KEY) || '[]');

    const list = document.getElementById('list');
    const input = document.getElementById('task');

    function save() {
      localStorage.setItem(KEY, JSON.stringify(tasks));
    }

    function render() {
      list.innerHTML = '';
      tasks.forEach((t, i) => {
        const li = document.createElement('li');
        if (t.done) li.classList.add('done');

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = t.done;
        cb.addEventListener('change', () => {
          tasks[i].done = cb.checked;
          save(); render();
        });

        const span = document.createElement('span');
        span.textContent = t.text;

        const del = document.createElement('button');
        del.textContent = '✕';
        del.className = 'del-btn';
        del.addEventListener('click', () => {
          tasks.splice(i, 1);
          save(); render();
        });

        li.append(cb, span, del);
        list.appendChild(li);
      });
    }

    document.getElementById('addBtn').addEventListener('click', () => {
      const text = input.value.trim();
      if (!text) return;
      tasks.push({ text, done: false });
      save(); render();
      input.value = '';
      input.focus();
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('addBtn').click(); });

    render();
  </script>
</body>
</html>` },
          { type: 'callout', tone: 'tip', label: 'Mental shift', html: `Notice we restructured the code: a <code>tasks</code> array is the <strong>source of truth</strong>, and <code>render()</code> rebuilds the UI from it. This is the core idea behind React, Vue, Svelte, and every modern framework.` },
          { type: 'callout', tone: 'warn', label: 'Important note', html: `localStorage in this in-app preview is sandboxed and won't survive across iframe reloads. Open the same code in a standalone HTML file (or use the in-browser StackBlitz/CodePen) to see real persistence.` },
        ]
      },
      {
        id: 'p1-step-6',
        title: 'Step 6 — Ship it',
        blocks: [
          { type: 'text', html: `
            <p>You just built a real app. Time to put it on the internet so anyone can use it.</p>
            <h3>The 3-minute deploy</h3>
            <ol>
              <li>Save your final HTML to a file called <code>index.html</code> in a new folder.</li>
              <li>Open <a href="https://github.com" target="_blank" rel="noopener">github.com</a>, create a new repo (e.g. <code>my-todo-app</code>), and upload that file.</li>
              <li>Go to the repo's Settings → Pages → set Source to "main" branch, root folder. Save.</li>
              <li>Wait ~30 seconds. Your app is live at <code>https://&lt;your-username&gt;.github.io/my-todo-app/</code>.</li>
            </ol>
            <p>That URL is real. You can text it to your friends. Add it to your portfolio. <strong>This is what shipping feels like.</strong></p>
            <h3>Next-level upgrades</h3>
            <ul>
              <li>Add categories or tags</li>
              <li>Add due dates and overdue highlighting</li>
              <li>Add a "Clear completed" button</li>
              <li>Add a search/filter input</li>
              <li>Make tasks reorderable by drag-and-drop</li>
              <li>Sync to a real backend (you'll learn this in the architecture and cloud modules)</li>
            </ul>
          ` },
          { type: 'callout', tone: 'tip', label: 'Take the win', html: `Most people who say they want to learn to code never finish a single project. You did. Pin this repo on your GitHub profile.` },
        ]
      },
    ],
  },
];

window.PROJECTS = PROJECTS;
