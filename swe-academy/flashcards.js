// Flashcards. Each card { id, front, back, topic } can be reviewed in the spaced
// repetition view. Cards are also referenced inline in lessons via the `flashcards`
// block type which shows them as a stack the user clicks through.

const FLASHCARDS = [
  // --- How the web works ---
  { id: 'fc-dns', topic: 'web', front: 'What does DNS do?', back: 'Translates a human-readable domain (google.com) into an IP address (142.250.80.46) so your computer knows where to send the request.' },
  { id: 'fc-http', topic: 'web', front: 'What is HTTP?', back: 'HyperText Transfer Protocol — the language clients and servers use to talk. A request has a method (GET, POST...), a path, headers, and an optional body.' },
  { id: 'fc-html-css-js', topic: 'web', front: 'What are the three pillars of front-end?', back: 'HTML (structure), CSS (style/layout), JavaScript (behavior).' },
  { id: 'fc-status-200', topic: 'web', front: 'What does HTTP status 200 mean?', back: 'OK — the request succeeded.' },
  { id: 'fc-status-404', topic: 'web', front: 'What does HTTP status 404 mean?', back: 'Not Found — the requested resource doesn\'t exist on the server.' },
  { id: 'fc-status-500', topic: 'web', front: 'What does HTTP status 500 mean?', back: 'Internal Server Error — the server crashed or hit an unhandled exception. Your fault, not the client\'s.' },

  // --- JavaScript ---
  { id: 'fc-let-const', topic: 'js', front: 'Difference between `let` and `const`?', back: '`let` allows reassignment; `const` does not. Default to `const` and only switch to `let` when you must reassign.' },
  { id: 'fc-eq', topic: 'js', front: 'Difference between `==` and `===`?', back: '`==` does type coercion (1 == "1" is true). `===` is strict — same value AND same type. Always use `===`.' },
  { id: 'fc-map', topic: 'js', front: 'What does `array.map(fn)` do?', back: 'Returns a NEW array with `fn` applied to each item. Doesn\'t mutate the original.' },
  { id: 'fc-filter', topic: 'js', front: 'What does `array.filter(fn)` do?', back: 'Returns a NEW array containing only items for which `fn(item)` returns true.' },
  { id: 'fc-reduce', topic: 'js', front: 'What does `array.reduce(fn, init)` do?', back: 'Combines the array into a single value by repeatedly applying `fn(acc, item)`, starting from `init`.' },
  { id: 'fc-async', topic: 'js', front: 'What does `await` do?', back: 'Pauses execution inside an `async` function until a Promise resolves, then continues with the resolved value.' },
  { id: 'fc-promise', topic: 'js', front: 'What is a Promise?', back: 'An object representing a value that will be available later (or an error). It has states: pending → fulfilled OR rejected.' },
  { id: 'fc-arrow', topic: 'js', front: 'Arrow function syntax for `add(a,b) { return a+b }`?', back: '`const add = (a, b) => a + b;` — implicit return when there\'s no body braces.' },
  { id: 'fc-falsy', topic: 'js', front: 'What are JavaScript\'s falsy values?', back: '`false`, `0`, `""` (empty string), `null`, `undefined`, `NaN`. Everything else is truthy — including `[]` and `{}`.' },

  // --- APIs ---
  { id: 'fc-rest', topic: 'api', front: 'What is REST?', back: 'An architectural style where you map HTTP verbs (GET/POST/PUT/PATCH/DELETE) onto resource URLs (/users/5, /posts).' },
  { id: 'fc-json', topic: 'api', front: 'What is JSON?', back: 'JavaScript Object Notation — a lightweight text format for data, looks like a JS object: `{"id": 5, "name": "Alex"}`. The dominant API data format.' },
  { id: 'fc-get-vs-post', topic: 'api', front: 'When to use GET vs POST?', back: 'GET = read-only, no side effects, cacheable. POST = create or trigger an action. PUT/PATCH = update. DELETE = remove.' },
  { id: 'fc-graphql', topic: 'api', front: 'How is GraphQL different from REST?', back: 'Client sends a query specifying exactly which fields it wants back. Avoids over-fetching/under-fetching. One endpoint instead of many.' },

  // --- Databases ---
  { id: 'fc-sql-vs-nosql', topic: 'db', front: 'When to choose SQL vs NoSQL?', back: 'SQL (Postgres) for structured data with relationships, transactions, strict schema (default choice). NoSQL (Mongo) for flexible/document-shaped data or rapid prototyping.' },
  { id: 'fc-pk', topic: 'db', front: 'What is a primary key?', back: 'A column (or set) that uniquely identifies each row in a table. The DB enforces uniqueness and creates an index for fast lookup.' },
  { id: 'fc-fk', topic: 'db', front: 'What is a foreign key?', back: 'A column that references the primary key of another table — creates a relationship between tables (e.g. `posts.user_id` → `users.id`).' },
  { id: 'fc-join', topic: 'db', front: 'What does a SQL JOIN do?', back: 'Combines rows from two or more tables based on a matching column. Lets you query across relationships in one statement.' },
  { id: 'fc-index', topic: 'db', front: 'What is a database index?', back: 'A separate sorted data structure that lets the DB find rows quickly without scanning the whole table. Speeds up reads, slows down writes slightly.' },
  { id: 'fc-acid', topic: 'db', front: 'What does ACID stand for?', back: 'Atomicity, Consistency, Isolation, Durability — the guarantees a relational DB gives transactions. All-or-nothing changes that survive crashes.' },

  // --- Git ---
  { id: 'fc-git-add', topic: 'git', front: 'What does `git add` do?', back: 'Stages files — marks them to be included in the next commit. Doesn\'t save them yet.' },
  { id: 'fc-git-commit', topic: 'git', front: 'What does `git commit` do?', back: 'Saves the staged changes as a permanent snapshot in your local repo, with a message.' },
  { id: 'fc-git-push', topic: 'git', front: 'What does `git push` do?', back: 'Uploads your local commits to the remote repository (e.g. GitHub).' },
  { id: 'fc-git-branch', topic: 'git', front: 'Why use a branch?', back: 'Isolates your work — you can experiment freely, then merge it back to main when ready. Lets multiple people work in parallel without stepping on each other.' },
  { id: 'fc-git-merge', topic: 'git', front: 'What is a merge conflict?', back: 'When two branches edited the same lines of the same file, Git can\'t auto-combine them. You have to manually choose which version to keep.' },

  // --- Docker ---
  { id: 'fc-container', topic: 'docker', front: 'What is a container?', back: 'A lightweight isolated package containing your app + everything it needs to run (libraries, runtime, config). Runs identically anywhere.' },
  { id: 'fc-container-vs-vm', topic: 'docker', front: 'Container vs Virtual Machine?', back: 'Containers share the host kernel and start in seconds (lightweight). VMs simulate full hardware and take much longer/more resources.' },
  { id: 'fc-dockerfile', topic: 'docker', front: 'What is a Dockerfile?', back: 'A text recipe that describes how to build a container image: base OS, dependencies, code, and the command to run.' },
  { id: 'fc-docker-image', topic: 'docker', front: 'Image vs container?', back: 'Image = the static template (built from a Dockerfile). Container = a running instance of an image. Like class vs object.' },

  // --- Security ---
  { id: 'fc-sql-injection', topic: 'sec', front: 'What is SQL injection? How prevent?', back: 'When an attacker injects SQL via user input into a query string. Prevent with parameterized queries — never concatenate user input into SQL.' },
  { id: 'fc-xss', topic: 'sec', front: 'What is XSS?', back: 'Cross-Site Scripting — attacker injects executable JS into pages other users see. Prevent by escaping HTML when rendering user input.' },
  { id: 'fc-bcrypt', topic: 'sec', front: 'How should you store passwords?', back: 'Never plain text. Always hash with a slow function like bcrypt or argon2. Use HTTPS for transit. Don\'t roll your own auth.' },
  { id: 'fc-https', topic: 'sec', front: 'Why use HTTPS?', back: 'Encrypts traffic between client and server so attackers on the network can\'t read or tamper with requests. Use it for everything, always.' },

  // --- Architecture ---
  { id: 'fc-coupling', topic: 'arch', front: 'What is "low coupling"?', back: 'Components depend on each other as little as possible. Changing one shouldn\'t ripple through many others. Goal of good architecture.' },
  { id: 'fc-cohesion', topic: 'arch', front: 'What is "high cohesion"?', back: 'Things that change together live together. Code in a module should serve one clear purpose.' },
  { id: 'fc-mvc', topic: 'arch', front: 'What does MVC stand for?', back: 'Model (data + business rules) · View (presentation) · Controller (coordinates between them and handles requests).' },
  { id: 'fc-monolith', topic: 'arch', front: 'When should you use microservices?', back: 'Almost never to start. Only when teams or scaling needs genuinely require independent deployment of services. Default to a clean monolith.' },
  { id: 'fc-event-driven', topic: 'arch', front: 'What is event-driven architecture?', back: 'Services communicate by publishing events to a queue rather than calling each other directly. Decouples producers from consumers.' },

  // --- Cloud ---
  { id: 'fc-iaas-paas-saas', topic: 'cloud', front: 'IaaS vs PaaS vs SaaS?', back: 'IaaS = raw machines (EC2). PaaS = give them code, they run it (Heroku). SaaS = use the app (Gmail). Serverless/FaaS = upload a function (Lambda).' },
  { id: 'fc-s3', topic: 'cloud', front: 'What is AWS S3 used for?', back: 'Object storage — files of any size (images, video, backups). Cheap, infinitely scalable, very durable.' },
  { id: 'fc-ec2', topic: 'cloud', front: 'What is AWS EC2?', back: 'Elastic Compute Cloud — virtual machines you rent by the hour/second. The basic "give me a Linux box in the cloud" service.' },
  { id: 'fc-lambda', topic: 'cloud', front: 'What is AWS Lambda?', back: 'Serverless functions. You upload code, AWS runs it on demand without you managing any servers. Pay per millisecond of execution.' },
  { id: 'fc-cdn', topic: 'cloud', front: 'What is a CDN?', back: 'Content Delivery Network — caches your static assets at edge servers around the world so users get them from a nearby location, fast.' },
  { id: 'fc-cicd', topic: 'cloud', front: 'CI vs CD?', back: 'CI (Continuous Integration) = every push runs tests automatically. CD (Continuous Deployment) = passing builds get deployed automatically.' },
  { id: 'fc-k8s', topic: 'cloud', front: 'What does Kubernetes do?', back: 'Orchestrates many containers across many machines: schedules, restarts, scales, load-balances, rolls out new versions with zero downtime.' },

  // --- System Design ---
  { id: 'fc-vert-horiz', topic: 'system', front: 'Vertical vs horizontal scaling?', back: 'Vertical = bigger machine (simple, has a ceiling, single point of failure). Horizontal = more machines (infinite scale, but app must be stateless).' },
  { id: 'fc-cache', topic: 'system', front: 'Why use a cache?', back: 'Avoid recomputing or re-fetching expensive results. Most apps add Redis between app and DB to absorb read traffic.' },
  { id: 'fc-cache-aside', topic: 'system', front: 'Cache-aside pattern?', back: 'App checks cache first → if miss, query DB then write result to cache. The most common caching pattern.' },
  { id: 'fc-load-balancer', topic: 'system', front: 'What does a load balancer do?', back: 'Sits in front of multiple servers and distributes requests among them. Detects failures via health checks and routes around them.' },
  { id: 'fc-stateless', topic: 'system', front: 'Why must app servers be "stateless" to scale horizontally?', back: 'Any request might land on any server. If a server holds in-memory session data, the next request goes to a different server and that data is lost.' },
  { id: 'fc-fanout', topic: 'system', front: 'Fan-out on read vs fan-out on write?', back: 'Read: assemble feed at request time (simple, slow for users with many follows). Write: pre-compute feeds when content is posted (fast reads, expensive writes for celebrities).' },
  { id: 'fc-cap', topic: 'system', front: 'CAP theorem in one line?', back: 'In a distributed system you can have at most TWO of: Consistency, Availability, Partition tolerance. Real systems pick CP or AP.' },
];

window.FLASHCARDS = FLASHCARDS;
