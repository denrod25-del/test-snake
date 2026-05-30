// Coding challenges with auto-grading.
// Each test runs the student's code (which must define the named function),
// then asserts: fn(args) deeply equals expected.
//
// You can also use challenges as a "find the bug" exercise — set isBug:true
// and provide buggy starter code. Same test runner; the student edits until tests pass.

const CHALLENGES = [
  // ---------- Foundation: JS basics ----------
  {
    id: 'sum',
    topic: 'js',
    difficulty: 'easy',
    title: 'Sum of two numbers',
    moduleId: 'foundation', lessonId: 'js-basics',
    prompt: `Write a function <code>sum(a, b)</code> that returns the sum of two numbers.`,
    fn: 'sum',
    starter: `function sum(a, b) {
  // Your code here
  
}`,
    tests: [
      { args: [1, 2], expect: 3 },
      { args: [0, 0], expect: 0 },
      { args: [-5, 10], expect: 5 },
      { args: [1.5, 2.5], expect: 4 },
    ],
  },
  {
    id: 'is-even',
    topic: 'js',
    difficulty: 'easy',
    title: 'Even or odd',
    moduleId: 'foundation', lessonId: 'js-basics',
    prompt: `Write a function <code>isEven(n)</code> that returns <code>true</code> if <code>n</code> is even, <code>false</code> otherwise.`,
    fn: 'isEven',
    starter: `function isEven(n) {
  
}`,
    tests: [
      { args: [2], expect: true },
      { args: [3], expect: false },
      { args: [0], expect: true },
      { args: [-4], expect: true },
      { args: [-7], expect: false },
    ],
  },
  {
    id: 'fizzbuzz',
    topic: 'js',
    difficulty: 'easy',
    title: 'FizzBuzz',
    moduleId: 'foundation', lessonId: 'js-basics',
    prompt: `Classic interview question. Write <code>fizzbuzz(n)</code> that returns:
      <ul>
        <li><code>"FizzBuzz"</code> if <code>n</code> is divisible by both 3 and 5</li>
        <li><code>"Fizz"</code> if divisible by 3 only</li>
        <li><code>"Buzz"</code> if divisible by 5 only</li>
        <li>The number (as a string) otherwise</li>
      </ul>`,
    fn: 'fizzbuzz',
    starter: `function fizzbuzz(n) {
  
}`,
    tests: [
      { args: [3], expect: 'Fizz' },
      { args: [5], expect: 'Buzz' },
      { args: [15], expect: 'FizzBuzz' },
      { args: [7], expect: '7' },
      { args: [30], expect: 'FizzBuzz' },
      { args: [1], expect: '1' },
    ],
  },

  // ---------- Foundation: Arrays / Functions ----------
  {
    id: 'max-of-array',
    topic: 'js',
    difficulty: 'easy',
    title: 'Max of an array',
    moduleId: 'foundation', lessonId: 'js-functions',
    prompt: `Write <code>maxOf(arr)</code> that returns the largest number in <code>arr</code>. Return <code>null</code> if the array is empty.`,
    fn: 'maxOf',
    starter: `function maxOf(arr) {
  
}`,
    tests: [
      { args: [[1, 5, 2]], expect: 5 },
      { args: [[-1, -5, -2]], expect: -1 },
      { args: [[42]], expect: 42 },
      { args: [[]], expect: null },
    ],
  },
  {
    id: 'sum-evens',
    topic: 'js',
    difficulty: 'easy',
    title: 'Sum of even numbers',
    moduleId: 'foundation', lessonId: 'js-functions',
    prompt: `Write <code>sumEvens(arr)</code> that returns the sum of all even numbers in the array. Use <code>filter</code> + <code>reduce</code> if you can.`,
    fn: 'sumEvens',
    starter: `function sumEvens(arr) {
  
}`,
    tests: [
      { args: [[1, 2, 3, 4]], expect: 6 },
      { args: [[1, 3, 5]], expect: 0 },
      { args: [[]], expect: 0 },
      { args: [[2, 4, 6, 8]], expect: 20 },
    ],
  },
  {
    id: 'reverse-string',
    topic: 'js',
    difficulty: 'easy',
    title: 'Reverse a string',
    moduleId: 'foundation', lessonId: 'js-functions',
    prompt: `Write <code>reverse(s)</code> that returns the string reversed. <em>Hint: split, reverse, join — or write a loop.</em>`,
    fn: 'reverse',
    starter: `function reverse(s) {
  
}`,
    tests: [
      { args: ['hello'], expect: 'olleh' },
      { args: [''], expect: '' },
      { args: ['a'], expect: 'a' },
      { args: ['racecar'], expect: 'racecar' },
    ],
  },
  {
    id: 'count-vowels',
    topic: 'js',
    difficulty: 'easy',
    title: 'Count the vowels',
    moduleId: 'foundation', lessonId: 'js-functions',
    prompt: `Write <code>countVowels(s)</code> that returns the number of vowels (a, e, i, o, u) in the string. Case-insensitive.`,
    fn: 'countVowels',
    starter: `function countVowels(s) {
  
}`,
    tests: [
      { args: ['hello'], expect: 2 },
      { args: ['JavaScript'], expect: 3 },
      { args: ['xyz'], expect: 0 },
      { args: [''], expect: 0 },
      { args: ['AEIOU'], expect: 5 },
    ],
  },

  // ---------- Foundation: Objects / Async ----------
  {
    id: 'pluck-names',
    topic: 'js',
    difficulty: 'medium',
    title: 'Get all user names',
    moduleId: 'foundation', lessonId: 'js-objects-async',
    prompt: `Given an array of user objects like <code>{ name, age }</code>, write <code>names(users)</code> that returns an array of just the names.`,
    fn: 'names',
    starter: `function names(users) {
  
}`,
    tests: [
      { args: [[{ name: 'Alex', age: 25 }, { name: 'Sam', age: 30 }]], expect: ['Alex', 'Sam'] },
      { args: [[]], expect: [] },
      { args: [[{ name: 'Solo', age: 99 }]], expect: ['Solo'] },
    ],
  },
  {
    id: 'group-by-role',
    topic: 'js',
    difficulty: 'medium',
    title: 'Group users by role',
    moduleId: 'foundation', lessonId: 'js-objects-async',
    prompt: `Given users like <code>{ name, role }</code>, write <code>groupByRole(users)</code> that returns an object mapping each role to an array of names. <br/>Example: <code>[{name:'A',role:'admin'},{name:'B',role:'admin'},{name:'C',role:'user'}]</code> → <code>{admin:['A','B'], user:['C']}</code>`,
    fn: 'groupByRole',
    starter: `function groupByRole(users) {
  
}`,
    tests: [
      { args: [[{name:'A',role:'admin'},{name:'B',role:'admin'},{name:'C',role:'user'}]], expect: { admin: ['A','B'], user: ['C'] } },
      { args: [[]], expect: {} },
      { args: [[{name:'X',role:'guest'}]], expect: { guest: ['X'] } },
    ],
  },
  {
    id: 'unique',
    topic: 'js',
    difficulty: 'medium',
    title: 'Remove duplicates',
    moduleId: 'foundation', lessonId: 'js-functions',
    prompt: `Write <code>unique(arr)</code> that returns a new array with duplicates removed, preserving order.`,
    fn: 'unique',
    starter: `function unique(arr) {
  
}`,
    tests: [
      { args: [[1, 2, 2, 3, 1]], expect: [1, 2, 3] },
      { args: [['a','b','a','c']], expect: ['a','b','c'] },
      { args: [[]], expect: [] },
      { args: [[1,1,1,1]], expect: [1] },
    ],
  },
  {
    id: 'flatten',
    topic: 'js',
    difficulty: 'medium',
    title: 'Flatten one level',
    moduleId: 'foundation', lessonId: 'js-functions',
    prompt: `Write <code>flatten(arr)</code> that flattens an array of arrays by ONE level. <br/><code>[[1,2],[3,4]]</code> → <code>[1,2,3,4]</code>`,
    fn: 'flatten',
    starter: `function flatten(arr) {
  
}`,
    tests: [
      { args: [[[1,2],[3,4]]], expect: [1,2,3,4] },
      { args: [[[1],[2],[3]]], expect: [1,2,3] },
      { args: [[]], expect: [] },
      { args: [[[1,[2,3]],[4]]], expect: [1,[2,3],4] },
    ],
  },

  // ---------- Algorithms ----------
  {
    id: 'is-palindrome',
    topic: 'algo',
    difficulty: 'easy',
    title: 'Palindrome check',
    moduleId: 'foundation', lessonId: 'js-functions',
    prompt: `Write <code>isPalindrome(s)</code> that returns <code>true</code> if <code>s</code> reads the same forwards and backwards. Ignore case and non-letter characters.`,
    fn: 'isPalindrome',
    starter: `function isPalindrome(s) {
  
}`,
    tests: [
      { args: ['racecar'], expect: true },
      { args: ['hello'], expect: false },
      { args: ['A man a plan a canal Panama'], expect: true },
      { args: [''], expect: true },
      { args: ['Was it a car or a cat I saw?'], expect: true },
    ],
  },
  {
    id: 'fib',
    topic: 'algo',
    difficulty: 'medium',
    title: 'Nth Fibonacci number',
    moduleId: 'architecture', lessonId: 'clean-code',
    prompt: `Write <code>fib(n)</code> that returns the nth Fibonacci number. <br/>The sequence: 0, 1, 1, 2, 3, 5, 8, 13... so <code>fib(0)=0</code>, <code>fib(1)=1</code>, <code>fib(7)=13</code>.<br/><em>Bonus: do it iteratively (a loop, not recursion) for performance.</em>`,
    fn: 'fib',
    starter: `function fib(n) {
  
}`,
    tests: [
      { args: [0], expect: 0 },
      { args: [1], expect: 1 },
      { args: [7], expect: 13 },
      { args: [10], expect: 55 },
      { args: [20], expect: 6765 },
    ],
  },
  {
    id: 'two-sum',
    topic: 'algo',
    difficulty: 'medium',
    title: 'Two sum (LeetCode classic)',
    moduleId: 'positioning', lessonId: 'interview-prep',
    prompt: `Write <code>twoSum(nums, target)</code> that returns the indices of the two numbers in <code>nums</code> that add up to <code>target</code>. Assume exactly one solution exists. Return them as an array <code>[i, j]</code> with <code>i &lt; j</code>.<br/><em>Example: <code>twoSum([2,7,11,15], 9)</code> → <code>[0,1]</code> (because 2 + 7 = 9).</em>`,
    fn: 'twoSum',
    starter: `function twoSum(nums, target) {
  
}`,
    tests: [
      { args: [[2,7,11,15], 9], expect: [0,1] },
      { args: [[3,2,4], 6], expect: [1,2] },
      { args: [[3,3], 6], expect: [0,1] },
      { args: [[1,5,3,8,2], 10], expect: [0,3] },
    ],
  },
  {
    id: 'valid-parens',
    topic: 'algo',
    difficulty: 'medium',
    title: 'Valid parentheses',
    moduleId: 'positioning', lessonId: 'interview-prep',
    prompt: `Write <code>isValid(s)</code> that returns true if every opening bracket <code>(</code> <code>[</code> <code>{</code> has a matching closing bracket in the right order.<br/><em>Hint: a stack data structure (just an array with push/pop) is perfect for this.</em>`,
    fn: 'isValid',
    starter: `function isValid(s) {
  
}`,
    tests: [
      { args: ['()'], expect: true },
      { args: ['()[]{}'], expect: true },
      { args: ['(]'], expect: false },
      { args: ['([)]'], expect: false },
      { args: ['{[]}'], expect: true },
      { args: [''], expect: true },
      { args: ['('], expect: false },
    ],
  },

  // ---------- Find-the-bug ----------
  {
    id: 'bug-greet',
    topic: 'bug',
    difficulty: 'easy',
    title: 'Find the bug: greeting',
    moduleId: 'architecture', lessonId: 'clean-code',
    isBug: true,
    prompt: `This function is supposed to return a greeting like <code>"Hello, Alex"</code>. There's a bug. Find and fix it.`,
    fn: 'greet',
    starter: `function greet(name) {
  return "Hello," + name;
}`,
    tests: [
      { args: ['Alex'], expect: 'Hello, Alex' },
      { args: ['Sam'], expect: 'Hello, Sam' },
    ],
  },
  {
    id: 'bug-sum-array',
    topic: 'bug',
    difficulty: 'easy',
    title: 'Find the bug: sum array',
    moduleId: 'architecture', lessonId: 'clean-code',
    isBug: true,
    prompt: `This function should return the sum of all numbers in the array. Spot the bug.`,
    fn: 'sumArr',
    starter: `function sumArr(arr) {
  let total = 0;
  for (let i = 0; i <= arr.length; i++) {
    total += arr[i];
  }
  return total;
}`,
    tests: [
      { args: [[1,2,3]], expect: 6 },
      { args: [[10]], expect: 10 },
      { args: [[]], expect: 0 },
    ],
  },
  {
    id: 'bug-find-user',
    topic: 'bug',
    difficulty: 'medium',
    title: 'Find the bug: equality',
    moduleId: 'foundation', lessonId: 'security-basics',
    isBug: true,
    prompt: `This function checks if a user with the given <em>id</em> exists. It works for some inputs but not others. Find the subtle bug.<br/><em>Hint: think about JS equality.</em>`,
    fn: 'findUser',
    starter: `function findUser(users, id) {
  for (let u of users) {
    if (u.id == id) return u;
  }
  return null;
}`,
    tests: [
      { args: [[{id:1,name:'A'},{id:2,name:'B'}], 2], expect: {id:2,name:'B'} },
      { args: [[{id:1,name:'A'}], '1'], expect: null },
      { args: [[{id:1,name:'A'}], 0], expect: null },
    ],
  },
];

window.CHALLENGES = CHALLENGES;
