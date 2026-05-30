// External resources keyed by `${moduleId}/${lessonId}` (or by moduleId for fallback).
// Each resource: { kind: 'video'|'article'|'docs'|'course'|'book', label, url }

const RESOURCES = {
  'foundation/how-web-works': [
    { kind: 'video', label: 'How does the internet work? (Code.org, 1 min)', url: 'https://www.youtube.com/watch?v=Dxcc6ycZ73M' },
    { kind: 'article', label: 'MDN: How the web works', url: 'https://developer.mozilla.org/en-US/docs/Learn/Common_questions/Web_mechanics/How_does_the_Internet_work' },
    { kind: 'article', label: 'Cloudflare: What is HTTP?', url: 'https://www.cloudflare.com/learning/ddos/glossary/hypertext-transfer-protocol-http/' },
  ],
  'foundation/js-basics': [
    { kind: 'docs', label: 'MDN JavaScript Guide', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide' },
    { kind: 'course', label: 'JavaScript.info — full free book', url: 'https://javascript.info/' },
    { kind: 'video', label: 'JS Crash Course (Traversy, ~1hr)', url: 'https://www.youtube.com/watch?v=hdI2bqOjy3c' },
  ],
  'foundation/js-functions': [
    { kind: 'article', label: 'MDN: Array methods', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array' },
    { kind: 'video', label: 'map / filter / reduce explained (Fun Fun Function)', url: 'https://www.youtube.com/watch?v=Wl98eZpkp-c' },
  ],
  'foundation/js-objects-async': [
    { kind: 'article', label: 'MDN: Promises', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise' },
    { kind: 'article', label: 'Async/await deep dive (javascript.info)', url: 'https://javascript.info/async-await' },
  ],
  'foundation/apis-rest': [
    { kind: 'article', label: 'REST API tutorial', url: 'https://restfulapi.net/' },
    { kind: 'docs', label: 'MDN Fetch API', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API' },
    { kind: 'article', label: 'Free public APIs to play with', url: 'https://github.com/public-apis/public-apis' },
  ],
  'foundation/databases': [
    { kind: 'course', label: 'SQLBolt — interactive SQL lessons (free)', url: 'https://sqlbolt.com/' },
    { kind: 'docs', label: 'PostgreSQL official tutorial', url: 'https://www.postgresql.org/docs/current/tutorial.html' },
    { kind: 'docs', label: 'MongoDB Manual', url: 'https://www.mongodb.com/docs/manual/' },
  ],
  'foundation/git-github': [
    { kind: 'book', label: 'Pro Git book (free)', url: 'https://git-scm.com/book/en/v2' },
    { kind: 'course', label: 'Learn Git Branching (interactive game)', url: 'https://learngitbranching.js.org/' },
    { kind: 'docs', label: 'GitHub Skills (hands-on tutorials)', url: 'https://skills.github.com/' },
  ],
  'foundation/docker': [
    { kind: 'docs', label: 'Docker official "Get Started" guide', url: 'https://docs.docker.com/get-started/' },
    { kind: 'video', label: 'Docker Crash Course (Fireship, 11 min)', url: 'https://www.youtube.com/watch?v=gAkwW2tuIqE' },
  ],
  'foundation/security-basics': [
    { kind: 'docs', label: 'OWASP Top 10', url: 'https://owasp.org/www-project-top-ten/' },
    { kind: 'article', label: 'How to store passwords safely', url: 'https://crackstation.net/hashing-security.htm' },
  ],

  'architecture/why-architecture': [
    { kind: 'article', label: '"A Philosophy of Software Design" — book summary', url: 'https://web.stanford.edu/~ouster/cgi-bin/book.php' },
  ],
  'architecture/mvc': [
    { kind: 'article', label: 'MDN: MVC explained', url: 'https://developer.mozilla.org/en-US/docs/Glossary/MVC' },
  ],
  'architecture/monolith-vs-micro': [
    { kind: 'article', label: 'Martin Fowler — Monolith First', url: 'https://martinfowler.com/bliki/MonolithFirst.html' },
    { kind: 'article', label: 'Microservices — when (and when not)', url: 'https://martinfowler.com/articles/microservices.html' },
  ],
  'architecture/event-driven': [
    { kind: 'article', label: 'AWS: Event-driven architecture intro', url: 'https://aws.amazon.com/event-driven-architecture/' },
  ],
  'architecture/clean-code': [
    { kind: 'book', label: 'Clean Code — Robert C. Martin', url: 'https://www.goodreads.com/book/show/3735293-clean-code' },
    { kind: 'article', label: 'The Practical Test Pyramid', url: 'https://martinfowler.com/articles/practical-test-pyramid.html' },
  ],

  'cloud/what-is-cloud': [
    { kind: 'video', label: '"What is Cloud Computing?" (AWS, 7 min)', url: 'https://www.youtube.com/watch?v=mxT233EdY5c' },
  ],
  'cloud/aws-essentials': [
    { kind: 'docs', label: 'AWS Free Tier', url: 'https://aws.amazon.com/free/' },
    { kind: 'video', label: 'AWS Crash Course (Fireship, 16 min)', url: 'https://www.youtube.com/watch?v=3hLmDS179YE' },
  ],
  'cloud/cicd': [
    { kind: 'docs', label: 'GitHub Actions docs', url: 'https://docs.github.com/en/actions' },
  ],
  'cloud/kubernetes': [
    { kind: 'video', label: 'Kubernetes in 100 seconds (Fireship)', url: 'https://www.youtube.com/watch?v=PziYflu8cB8' },
    { kind: 'docs', label: 'Kubernetes the Hard Way (advanced)', url: 'https://github.com/kelseyhightower/kubernetes-the-hard-way' },
  ],

  'system/system-design-intro': [
    { kind: 'book', label: 'System Design Interview — Alex Xu', url: 'https://www.goodreads.com/book/show/54109255-system-design-interview-an-insider-s-guide' },
    { kind: 'video', label: 'ByteByteGo channel', url: 'https://www.youtube.com/c/ByteByteGo' },
  ],
  'system/scaling': [
    { kind: 'article', label: 'High Scalability (real-world architectures)', url: 'http://highscalability.com/' },
  ],
  'system/caching': [
    { kind: 'docs', label: 'Redis docs', url: 'https://redis.io/docs/' },
  ],
  'system/load-balancing': [
    { kind: 'article', label: 'Cloudflare: What is a load balancer?', url: 'https://www.cloudflare.com/learning/performance/what-is-load-balancing/' },
  ],
  'system/design-twitter': [
    { kind: 'video', label: 'Designing Twitter (HelloInterview)', url: 'https://www.hellointerview.com/learn/system-design/answer-keys/twitter' },
  ],

  'positioning/why-positioning': [
    { kind: 'book', label: '"So Good They Can\'t Ignore You" — Cal Newport', url: 'https://www.goodreads.com/book/show/13525945-so-good-they-can-t-ignore-you' },
  ],
  'positioning/github-portfolio': [
    { kind: 'article', label: 'How to write a great README', url: 'https://www.makeareadme.com/' },
  ],
  'positioning/building-in-public': [
    { kind: 'article', label: 'Patrick McKenzie — "Don\'t call yourself a programmer"', url: 'https://www.kalzumeus.com/2011/10/28/dont-call-yourself-a-programmer/' },
  ],
  'positioning/interview-prep': [
    { kind: 'course', label: 'NeetCode 150 (free curated list)', url: 'https://neetcode.io/' },
    { kind: 'course', label: 'Interviewing.io (free mock interviews)', url: 'https://interviewing.io/' },
    { kind: 'video', label: 'HelloInterview — system design walkthroughs', url: 'https://www.hellointerview.com/' },
  ],

  'roles/role-map': [
    { kind: 'article', label: 'StaffEng — Senior to Staff playbook', url: 'https://staffeng.com/' },
  ],
  'roles/where-to-apply': [
    { kind: 'article', label: 'levels.fyi (real comp data)', url: 'https://www.levels.fyi/' },
    { kind: 'article', label: 'Hacker News "Who is Hiring?"', url: 'https://news.ycombinator.com/submitted?id=whoishiring' },
  ],
  'roles/negotiate': [
    { kind: 'article', label: '"Salary Negotiation" — Patrick McKenzie (the canonical guide)', url: 'https://www.kalzumeus.com/2012/01/23/salary-negotiation/' },
    { kind: 'video', label: '10 Rules for Negotiating a Job Offer (Haseeb Qureshi)', url: 'https://haseebq.com/how-not-to-bomb-your-offer-negotiation/' },
  ],
  'roles/final-roadmap': [
    { kind: 'article', label: 'roadmap.sh — visual learning paths', url: 'https://roadmap.sh/full-stack' },
    { kind: 'course', label: 'The Odin Project (free, full curriculum)', url: 'https://www.theodinproject.com/' },
    { kind: 'course', label: 'freeCodeCamp', url: 'https://www.freecodecamp.org/' },
  ],
};

window.RESOURCES = RESOURCES;
