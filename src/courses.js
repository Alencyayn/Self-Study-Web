const svg = (content) => `<svg viewBox="0 0 140 110" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">${content}</svg>`;
export const art = {
  kernel: svg('<path d="M14 81 70 99l55-31-56-17Z" opacity=".35"/><path d="m70 99 1-77M14 81l111-13M32 95l77-44" opacity=".35"/><path d="m19 54 54 17 48-29-54-16Z"/><path d="m19 54 51 45m3-28-3 28m51-57L70 99M67 26l3 73" stroke-dasharray="3 3" opacity=".6"/><path d="M40 47 87 62M47 34l48 16" opacity=".45"/><circle cx="70" cy="99" r="3" fill="currentColor"/><path d="m69 14 2 8 3-7m52 50-1 3 4 1"/><text x="77" y="19" stroke="none" fill="currentColor" font-family="Georgia" font-size="10" font-style="italic">T(v)</text><text x="85" y="96" stroke="none" fill="currentColor" font-family="Georgia" font-size="10">0</text>'),
  derivative: svg('<path d="M18 90h106M28 100V13" opacity=".4"/><path d="m120 87 5 3-5 3M25 18l3-5 3 5" opacity=".4"/><path d="M33 87c22-2 43-17 52-36s12-28 14-37" stroke-width="1.4"/><path d="m43 99 64-77" stroke-width="1.1"/><path d="M77 58h26V27" stroke-dasharray="3 3" opacity=".4"/><circle cx="77" cy="58" r="3" fill="currentColor"/><text x="91" y="77" stroke="none" fill="currentColor" font-family="Georgia" font-style="italic" font-size="10">Δx</text><text x="108" y="48" stroke="none" fill="currentColor" font-family="Georgia" font-style="italic" font-size="10">Δy</text>'),
  recursion: svg('<path d="M70 14v21M70 35 37 55m33-20 33 20M37 55 20 80m17-25 17 25m49-25L86 80m17-25 17 25" opacity=".7"/><circle cx="70" cy="14" r="8" fill="var(--paper)"/><circle cx="37" cy="55" r="7" fill="var(--paper)"/><circle cx="103" cy="55" r="7" fill="var(--paper)"/><circle cx="20" cy="85" r="5" fill="currentColor" opacity=".55"/><circle cx="54" cy="85" r="5" fill="currentColor" opacity=".55"/><circle cx="86" cy="85" r="5" fill="currentColor" opacity=".55"/><circle cx="120" cy="85" r="5" fill="currentColor" opacity=".55"/><path d="M10 100h120" stroke-dasharray="3 4" opacity=".3"/>')
};
export const phases = [
  { title: 'Understanding', english: 'UNDERSTANDING', minutes: 10, description: 'Build an intuition before learning the definition.' },
  { title: 'Worked examples', english: 'WORKED EXAMPLE', minutes: 15, description: 'Follow a complete example and understand why each step works.' },
  { title: 'Independent practice', english: 'INDEPENDENT PRACTICE', minutes: 25, description: 'Try it yourself first. Open a hint only when you need one.' },
  { title: 'Active recall', english: 'ACTIVE RECALL', minutes: 10, description: 'Close your notes and see what you can explain from memory.' }
];
export const courses = [
  {
    id: 'kernel', number: '01', subject: 'Mathematics · Linear algebra', title: 'The kernel of a transformation', english: 'The kernel of a linear transformation', description: 'Which inputs does a transformation send back to zero?', short: 'Find the directions that disappear.',
    conceptTitle: 'What if a transformation made something disappear?',
    concept: '<p>Imagine projecting a three-dimensional object onto a table. Moving straight up does not change its shadow. That direction of information disappears.</p><p>The <strong>kernel</strong> is the set of all input vectors mapped to the zero vector.</p>',
    concise: 'The kernel is the set of all input vectors satisfying T(v) = 0. It describes which directions of information a linear transformation loses.',
    visualCaption: 'An entire line of inputs can collapse to the same origin. The kernel captures those lost directions.',
    deeper: 'The kernel always contains the zero vector, but it may contain others too. If the difference between two inputs is in the kernel, those inputs have the same output. The kernel therefore tells us whether a transformation can distinguish different inputs.',
    question: 'Are the vectors in a kernel inputs or outputs? What do they all have in common?',
    understandingChecks: ['I can explain that a kernel is a set of input vectors whose outputs are all zero.'],
    examplePrompt: 'Let T(x, y) = (x + y, 0). Find its kernel.',
    steps: [
      ['Start with the definition', 'Set T(x, y) = (0, 0), so (x + y, 0) = (0, 0). We are looking for inputs that produce the zero output.'],
      ['Find the relationship between inputs', 'We need x + y = 0, or x = −y. The second output is already zero, so it adds no further condition.'],
      ['Describe every solution with a parameter', 'Let x = t. Then y = −t, so (x, y) = (t, −t) = t(1, −1), for any real t.'],
      ['Return to the geometry', 'ker(T) = span{(1, −1)}. The kernel is a line through the origin, not just a single vector. Every vector on it maps to (0, 0).']
    ],
    variants: [
      { prompt: 'Let T(x, y) = (x + 2y, 0). Find ker(T) and explain its geometric shape.', rubric: ['I set both output components equal to zero.', 'I described all solutions, not just one vector.', 'I explained why the kernel is a line through the origin.'], solution: 'T(x, y) = (0, 0) gives x + 2y = 0.\nLet y = t, so x = −2t.\nker(T) = {t(−2, 1) | t ∈ ℝ} = span{(−2, 1)}.\nGeometrically, this is a line through the origin.', hints: ['The kernel contains inputs that map to zero. Start with T(v) = 0.', 'Set each output component equal to zero to find the relationship between x and y.', 'From x + 2y = 0, let y = t and express x in terms of t.'] },
      { prompt: 'Now let T(x, y) = (2x + y, 0). Find ker(T), then substitute your answer to check it.', rubric: ['I started with T(x, y) = (0, 0).', 'I used a real parameter to describe every solution.', 'I substituted the solution and checked that the output is zero.'], solution: '2x + y = 0. Let x = t, so y = −2t.\nker(T) = {t(1, −2) | t ∈ ℝ}.\nCheck: T(t, −2t) = (2t − 2t, 0) = (0, 0).', hints: ['Use the same idea: set the output equal to zero.', 'Solve 2x + y = 0 while leaving one free parameter.', 'Let x = t. Then y = −2t.'] }
    ],
    recallQuestions: ['Explain the kernel of a linear transformation without looking at the definition.', 'Why must the zero vector belong to the kernel?', 'If the kernel contains only zero, can two different inputs have the same output? Explain.'],
    recallRubric: ['I can define a kernel and distinguish inputs from outputs.', 'I can explain T(0) = 0 and how the kernel describes lost information.', 'I can use T(u − v) = 0 to explain why a trivial kernel means the transformation is one-to-one onto its image.'],
    recallAnswer: 'The kernel is the set of inputs v such that T(v) = 0. A linear transformation satisfies T(0) = 0, so zero is always in the kernel. If T(u) = T(v), then T(u − v) = 0. When the kernel contains only zero, u − v = 0, so u = v.'
  },
  {
    id: 'derivative', number: '02', subject: 'Mathematics · Calculus', title: 'An intuition for derivatives', english: 'An intuition for derivatives', description: 'Make sense of change at a single instant.', short: 'From average speed to instantaneous change.',
    conceptTitle: 'Can a photograph tell you how fast a car is moving?',
    concept: '<p>Distance divided by time gives average speed. A derivative describes how fast something is changing at one instant.</p>',
    concise: 'A derivative is an instantaneous rate of change. On a graph, it is the slope of the tangent line at a point. It comes from the limit of average rates over smaller and smaller intervals.',
    visualCaption: 'As two points approach one another, their secant line approaches the tangent.',
    deeper: 'For f(x), the average rate of change from x to x + h is [f(x + h) − f(x)] / h. Let h approach zero without dividing by zero to obtain f′(x). Its units are output units per input unit.',
    question: 'How is a function value different from its derivative? If the derivative of position is zero, must the position itself be zero?',
    understandingChecks: ['I can distinguish a current value from its rate of change, and explain why a zero derivative does not imply a zero function value.'],
    examplePrompt: 'Let f(x) = x². Use the idea of a rate of change to find the derivative at x = 2.',
    steps: [
      ['Consider a small change', 'Moving from 2 to 2 + h changes the function from 4 to (2 + h)². The change in output is 4h + h².'],
      ['Calculate the average rate', 'Divide the output change by h: (4h + h²) / h = 4 + h, with h ≠ 0.'],
      ['Let the interval approach zero', 'As h approaches zero, 4 + h approaches 4. Therefore f′(2) = 4. This is a limit, not a substitution of zero into the denominator.'],
      ['Interpret the result', 'Near x = 2, a small change in x produces roughly four times that change in f(x). The tangent slope is 4.']
    ],
    variants: [
      { prompt: 'For f(x) = x², what is the tangent slope at x = 3? Explain your reasoning.', rubric: ['I calculated a rate of change, not f(3).', 'I explained the result using a difference quotient or f′(x) = 2x.', 'I interpreted the answer as an instantaneous rate at x = 3.'], solution: 'f′(x) = 2x, so f′(3) = 6.\nAlternatively, [(3 + h)² − 9] / h = 6 + h.\nAs h → 0, the quotient approaches 6. The tangent slope is 6.', hints: ['A tangent slope is a derivative, not the height of the curve.', 'Use the difference quotient from the example, or first find f′(x).', 'f′(x) = 2x. Substitute x = 3.'] },
      { prompt: 'For f(x) = x², find the tangent slope at x = −2. What does the negative sign mean?', rubric: ['I found the correct derivative value.', 'I explained that a negative slope means f decreases as x increases nearby.', 'I did not confuse the derivative with the function value.'], solution: 'f′(x) = 2x, so f′(−2) = −4.\nThe negative sign means that near x = −2, the function decreases as x increases.', hints: ['A derivative can be negative. Distinguish the height of the curve from its direction.', 'Use f′(x) = 2x.', 'Substitute x = −2 into 2x, then interpret its sign.'] }
    ],
    recallQuestions: ['Explain a derivative without using the phrase “differentiation rule”.', 'Why can we not simply put h = 0 into the difference quotient?', 'If a temperature function has a negative derivative, what does that mean?'],
    recallRubric: ['I can explain an instantaneous rate and a tangent slope.', 'I can distinguish taking a limit from dividing by zero.', 'I can interpret a negative derivative in a new context such as falling temperature.'],
    recallAnswer: 'A derivative describes the rate and direction of change at an instant; on a graph it is a tangent slope. We cannot divide by h = 0, so we consider the limit as h approaches zero. A negative temperature derivative means the temperature is falling, not that it is below zero.'
  },
  {
    id: 'recursion', number: '03', subject: 'Programming · Computational thinking', title: 'Thinking in recursion', english: 'Thinking in recursion', description: 'Give a smaller version of the problem to a smaller version of yourself.', short: 'Solve a problem through smaller instances of itself.',
    conceptTitle: 'If the problem feels too big, try a smaller version.',
    concept: '<p>A recursive function calls itself to solve a smaller instance of the same problem. A base case tells it when to stop.</p>',
    concise: 'Recursion solves a problem by calling the same function on a smaller instance. It needs a reachable base case and a recursive step that moves towards it.',
    visualCaption: 'Each call moves towards a simpler case. Once the base case is reached, results return through the calls.',
    deeper: 'Calling itself is not enough. If countdown(n) always calls countdown(n), the problem never gets smaller. Start by asking: what is the simplest case, and how does every other case move towards it?',
    question: 'Why does recursion need both a base case and a step that makes the problem smaller? What happens if either one is missing?',
    understandingChecks: ['I can identify the base case and recursive step, and explain why each call must approach termination.'],
    examplePrompt: 'Define factorial(n): return 1 when n ≤ 1; otherwise return n × factorial(n − 1). Trace factorial(3), for nonnegative integer n.',
    steps: [
      ['Identify the base case', 'factorial(1) = 1. The simplest case returns directly without another recursive call.'],
      ['Make the problem smaller', 'factorial(3) = 3 × factorial(2), and factorial(2) = 2 × factorial(1). The argument decreases by 1 each time.'],
      ['Reach the stopping point', 'factorial(1) returns 1. Calls stop going deeper and begin returning their results.'],
      ['Return through the calls', 'factorial(2) returns 2 × 1 = 2, then factorial(3) returns 3 × 2 = 6. Calls expand downward; results return upward.']
    ],
    variants: [
      { prompt: 'Using that definition, what does factorial(4) return? Show the calls and their return values.', rubric: ['I traced the calls 4 → 3 → 2 → 1.', 'I stopped at the base case.', 'I combined the results in the correct return order.'], solution: 'factorial(4) = 4 × factorial(3)\n= 4 × 3 × factorial(2)\n= 4 × 3 × 2 × factorial(1)\n= 4 × 3 × 2 × 1 = 24.\nThe return values are 1, 2, 6 and 24.', hints: ['Find the base case: return 1 when n ≤ 1.', 'Starting at factorial(4), decrease n by 1 on each call.', 'Write 4 × factorial(3), expand down to factorial(1), then multiply as calls return.'] },
      { prompt: 'What does factorial(5) return? If n − 1 were accidentally replaced by n, what would happen?', rubric: ['I calculated factorial(5) correctly.', 'I explained why an unchanged argument cannot reach the base case.', 'I recognised that repeated calls can eventually overflow the call stack.'], solution: 'factorial(5) = 5 × 24 = 120.\nCalling factorial(n) again with n > 1 would never reach the base case. Calls would continue until the call stack overflows.', hints: ['Reuse your previous result for factorial(4).', 'factorial(5) = 5 × factorial(4).', 'Calculate 5 × 24. Then ask when an argument that never decreases could reach 1.'] }
    ],
    recallQuestions: ['Name the two elements a recursive solution needs without checking your notes.', 'Why can a recursive call not keep using the same unchanged argument forever?', 'For counting files in nested folders, what is a base case and what is a smaller problem?'],
    recallRubric: ['I can explain a base case and a recursive step.', 'I can explain why calls must move towards the base case.', 'I can transfer the idea: count a single file directly and recursively count files inside subfolders.'],
    recallAnswer: 'Recursion needs a base case and a step that makes the problem smaller. Without progress towards the base case, calls may never terminate. To count files, count one file as 1 and an empty folder as 0, then recursively count and sum the files in each subfolder.'
  }
];
