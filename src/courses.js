const svg = (content) => `<svg viewBox="0 0 140 110" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">${content}</svg>`;
export const art = {
  kernel: svg('<path d="M14 81 70 99l55-31-56-17Z" opacity=".35"/><path d="m70 99 1-77M14 81l111-13M32 95l77-44" opacity=".35"/><path d="m19 54 54 17 48-29-54-16Z"/><path d="m19 54 51 45m3-28-3 28m51-57L70 99M67 26l3 73" stroke-dasharray="3 3" opacity=".6"/><path d="M40 47 87 62M47 34l48 16" opacity=".45"/><circle cx="70" cy="99" r="3" fill="currentColor"/><path d="m69 14 2 8 3-7m52 50-1 3 4 1"/><text x="77" y="19" stroke="none" fill="currentColor" font-family="Georgia" font-size="10" font-style="italic">T(v)</text><text x="85" y="96" stroke="none" fill="currentColor" font-family="Georgia" font-size="10">0</text>'),
  derivative: svg('<path d="M18 90h106M28 100V13" opacity=".4"/><path d="m120 87 5 3-5 3M25 18l3-5 3 5" opacity=".4"/><path d="M33 87c22-2 43-17 52-36s12-28 14-37" stroke-width="1.4"/><path d="m43 99 64-77" stroke-width="1.1"/><path d="M77 58h26V27" stroke-dasharray="3 3" opacity=".4"/><circle cx="77" cy="58" r="3" fill="currentColor"/><text x="91" y="77" stroke="none" fill="currentColor" font-family="Georgia" font-style="italic" font-size="10">Δx</text><text x="108" y="48" stroke="none" fill="currentColor" font-family="Georgia" font-style="italic" font-size="10">Δy</text>'),
  recursion: svg('<path d="M70 14v21M70 35 37 55m33-20 33 20M37 55 20 80m17-25 17 25m49-25L86 80m17-25 17 25" opacity=".7"/><circle cx="70" cy="14" r="8" fill="var(--paper)"/><circle cx="37" cy="55" r="7" fill="var(--paper)"/><circle cx="103" cy="55" r="7" fill="var(--paper)"/><circle cx="20" cy="85" r="5" fill="currentColor" opacity=".55"/><circle cx="54" cy="85" r="5" fill="currentColor" opacity=".55"/><circle cx="86" cy="85" r="5" fill="currentColor" opacity=".55"/><circle cx="120" cy="85" r="5" fill="currentColor" opacity=".55"/><path d="M10 100h120" stroke-dasharray="3 4" opacity=".3"/>')
};
export const phases = [
  { title: '建立理解', english: 'UNDERSTANDING', minutes: 10, description: '先建立直觉，再认识概念。' },
  { title: '完整例题', english: 'WORKED EXAMPLE', minutes: 15, description: '跟随完整示范，理解每一步的理由。' },
  { title: '独立练习', english: 'INDEPENDENT PRACTICE', minutes: 25, description: '先自己尝试。需要时，再展开一点提示。' },
  { title: '闭卷回忆', english: 'ACTIVE RECALL', minutes: 10, description: '合上资料，让知识从自己的记忆中生长。' }
];
export const courses = [
  {
    id: 'kernel', number: '01', subject: '数学 · 线性代数', title: '线性变换的核', english: 'The kernel of a linear transformation', description: '理解一个变换，把哪些向量带回了原点。', short: '从“变成零”，理解变换的本质',
    conceptTitle: '如果一个变换，让某些东西消失了呢？',
    concept: '<p>想象用一盏灯，把三维空间中的物体投影到桌面。竖直方向上的移动，不会改变桌面上的影子——这个方向的信息“消失”了。</p><p>线性变换的<strong>核（Kernel）</strong>，就是所有被映射到零向量的输入向量组成的集合。记作 <em>ker(T) = { v | T(v) = 0 }</em>。</p>',
    concise: '核是所有满足 T(v) = 0 的输入向量组成的集合。它描述线性变换丢失了哪些方向的信息。',
    visualCaption: '一整条线上的向量，都可能被压缩到同一个原点。核描述的，就是这些“消失”的方向。',
    deeper: '核里一定有零向量，但不一定只有零向量。如果两个输入之差在核里，它们就会产生相同的输出。所以，核也告诉我们：这个变换能不能区分不同的输入。',
    question: '用自己的话说说：核里的向量，是变换的输入，还是输出？它们有什么共同点？',
    understandingChecks: ['我能说清：核是输入向量的集合，这些向量的输出都是零向量。'],
    examplePrompt: '设 T(x, y) = (x + y, 0)。求这个变换的核。',
    steps: [
      ['从定义出发，把输出设为零', 'T(x, y) = (0, 0)，于是 (x + y, 0) = (0, 0)。核关心的是哪些输入产生零输出。'],
      ['解出输入必须满足的关系', '只需要 x + y = 0，即 x = −y。第二个分量本来就是 0，不会再增加条件。'],
      ['用一个参数，表示所有解', '令 x = t，那么 y = −t。所以 (x, y) = (t, −t) = t(1, −1)，其中 t 是任意实数。'],
      ['回到几何意义', 'ker(T) = span{(1, −1)}。核是一条过原点的直线，而不只是一个向量。把线上的任意向量代回 T，输出都会是 (0, 0)。']
    ],
    variants: [
      { prompt: '设 T(x, y) = (x + 2y, 0)。求 ker(T)，并说明它的几何形状。', rubric: ['我把两个输出分量都设成了零。', '我表示了所有解，而不只是找出一个向量。', '我检查了这是一条经过原点的直线。'], solution: '由 T(x, y) = (0, 0)，得 x + 2y = 0。\n令 y = t，则 x = −2t。\nker(T) = { t(−2, 1) | t ∈ ℝ } = span{(−2, 1)}。\n几何上，这是一条过原点的直线。', hints: ['核包含所有被映射到零向量的输入。先回忆 T(v) = 0。', '把输出的两个分量分别与零比较，得到输入之间的关系。', '由 x + 2y = 0，可令 y = t，再表示 x。'] },
      { prompt: '换一个变换：T(x, y) = (2x + y, 0)。求 ker(T)，并代入检验。', rubric: ['我从 T(x, y) = (0, 0) 出发。', '我使用任意实数参数表示了所有解。', '我把解代回了变换，检验输出是否为零。'], solution: '2x + y = 0。令 x = t，则 y = −2t。\nker(T) = { t(1, −2) | t ∈ ℝ }。\n检验：T(t, −2t) = (2t − 2t, 0) = (0, 0)。', hints: ['方法与刚才一致：先把输出设为零。', '解 2x + y = 0，留下一个自由参数。', '令 x = t，可得 y = −2t。'] }
    ],
    recallQuestions: ['不看资料，解释什么是线性变换的核。', '为什么核里一定包含零向量？', '如果一个变换的核只有零向量，它还会把两个不同输入变成相同输出吗？为什么？'],
    recallRubric: ['我能独立给出核的定义，区分输入向量与输出向量。', '我能解释 T(0) = 0，并说明核反映丢失的信息。', '我能用 T(u − v) = 0 解释：核只有零向量时，变换是一一对应到其像的。'],
    recallAnswer: '核是满足 T(v) = 0 的所有输入向量组成的集合。线性变换满足 T(0) = 0，因此零向量总在核里。若 T(u) = T(v)，则 T(u − v) = 0；核只有零向量时，u − v = 0，所以 u = v。'
  },
  {
    id: 'derivative', number: '02', subject: '数学 · 微积分', title: '导数的直觉', english: 'An intuition for derivatives', description: '把瞬间的变化，变成一个可以理解的数字。', short: '从平均速度，走向瞬时变化率',
    conceptTitle: '一张照片，能告诉你车开得多快吗？',
    concept: '<p>一段路程除以时间，得到的是<strong>平均速度</strong>。但我们常常更关心：就在这一刻，变化有多快？</p><p>把时间间隔缩得越来越小，平均变化率就趋近于<strong>瞬时变化率</strong>，这就是导数。在图像上，它是曲线在该点的切线斜率。</p>',
    concise: '导数是瞬时变化率，也就是曲线在一点的切线斜率。它来自平均变化率在区间长度趋近于零时的极限。',
    visualCaption: '两点之间的割线，不断靠近这一点时，就逐渐变成了切线。',
    deeper: '对于 f(x)，从 x 到 x + h 的平均变化率是 [f(x + h) − f(x)] / h。让 h 趋近 0（但不直接除以 0），得到 f′(x)。导数的单位是“输出单位 / 输入单位”。',
    question: '函数值和导数有什么区别？如果位置函数的导数为零，就意味着物体的位置也为零吗？',
    understandingChecks: ['我能区分“当前的值”和“当前变化的快慢”，知道导数为零不等于函数值为零。'],
    examplePrompt: '设 f(x) = x²。用变化率的想法，求它在 x = 2 处的导数。',
    steps: [
      ['先看一个很小的变化', '从 2 走到 2 + h，函数值从 4 变成 (2 + h)²。变化量是 4h + h²。'],
      ['计算平均变化率', '用函数变化量除以输入变化量 h，得到 (4h + h²) / h = 4 + h，其中 h ≠ 0。'],
      ['让间隔趋近于零', 'h 越接近 0，4 + h 越接近 4。因此 f′(2) = 4。这里求的是极限，不是把 h = 0 代入分母。'],
      ['解释结果', '在 x = 2 附近，x 每增加一个很小的量，f(x) 大约增加该变化量的 4 倍。切线的斜率就是 4。']
    ],
    variants: [
      { prompt: 'f(x) = x²。在 x = 3 处，曲线的切线斜率是多少？请写出思路。', rubric: ['我计算的是变化率，而不是函数值 f(3)。', '我能从差商或 f′(x) = 2x 解释结果。', '我理解结果表示 x = 3 附近的瞬时变化率。'], solution: 'f′(x) = 2x，因此 f′(3) = 6。\n也可以计算：[(3 + h)² − 9] / h = 6 + h。\n当 h → 0 时，差商趋近于 6。所以切线斜率为 6。', hints: ['切线斜率对应导数，不是曲线在该点的高度。', '可以沿用例题的差商方法，也可以先求 f′(x)。', 'f′(x) = 2x，把 x = 3 代进去。'] },
      { prompt: '仍然是 f(x) = x²。在 x = −2 处，切线斜率是多少？负号有什么意义？', rubric: ['我得到了正确的导数值。', '我解释了负号表示函数在该点附近随 x 增大而下降。', '我没有把函数值与导数混淆。'], solution: 'f′(x) = 2x，所以 f′(−2) = −4。\n负号表示：在 x = −2 附近，随着 x 增大，函数值减小。', hints: ['导数也可以是负数。先区分曲线的高度和走向。', '使用 f′(x) = 2x。', '把 x = −2 代入 2x，然后解释负号。'] }
    ],
    recallQuestions: ['用自己的话解释导数，不使用“求导公式”这个词。', '为什么不能直接把差商中的 h 设为零？', '若温度随时间变化，温度函数的导数为负，意味着什么？'],
    recallRubric: ['我能独立解释瞬时变化率和切线斜率。', '我能说明极限与直接除以零的区别。', '我能把负导数迁移到温度下降的实际情境。'],
    recallAnswer: '导数描述某个瞬间变化的快慢与方向，在图像上是切线斜率。差商中 h 不能等于 0；我们研究的是 h 趋近 0 时的极限。温度对时间的导数为负，表示这一刻温度正在下降，并不意味着温度本身低于零。'
  },
  {
    id: 'recursion', number: '03', subject: '编程 · 计算思维', title: '递归的思想', english: 'Thinking in recursion', description: '把一个问题，交给一个更小的自己。', short: '从一个大问题，找到更小的同类问题',
    conceptTitle: '如果问题太大，就先解决小一点的它。',
    concept: '<p>想象一排人传话：你想知道一共有多少人，只需问身后的人“你后面有多少人”，再加上自己。</p><p><strong>递归</strong>就是函数调用自身，把问题拆成更小的同类问题。它需要两个关键：<strong>递归步骤</strong>让问题变小，<strong>基本情况</strong>让调用停下来。</p>',
    concise: '递归通过调用自身，解决更小的同类问题。必须有可到达的基本情况，并让每次调用都向它靠近。',
    visualCaption: '每一次分解都朝更简单的情况前进。遇到基本情况后，结果逐层返回。',
    deeper: '只有“调用自己”还不够。比如 countdown(n) 总是调用 countdown(n)，问题并没有变小，就会无限递归。定义递归时，先问：最简单的情况是什么？其余情况怎样向它靠近？',
    question: '递归为什么既需要基本情况，也需要让问题变小的步骤？缺少其中一个，会发生什么？',
    understandingChecks: ['我能说出终止条件和递归步骤，并解释为何每次调用必须靠近终止条件。'],
    examplePrompt: '定义 factorial(n)：若 n ≤ 1，返回 1；否则返回 n × factorial(n − 1)。理解 factorial(3) 如何求值。',
    steps: [
      ['确定基本情况', 'factorial(1) = 1。最简单的情况直接返回，不再调用自身。这里讨论 n 为非负整数。'],
      ['把问题变小', 'factorial(3) = 3 × factorial(2)，而 factorial(2) = 2 × factorial(1)。每次 n 减少 1。'],
      ['抵达基本情况', '当调用 factorial(1) 时得到 1，递归不再深入，开始把结果向上返回。'],
      ['逐层返回结果', 'factorial(2) = 2 × 1 = 2，然后 factorial(3) = 3 × 2 = 6。调用向下展开，结果向上返回。']
    ],
    variants: [
      { prompt: '使用刚才的定义，factorial(4) 返回多少？请写出调用与返回的过程。', rubric: ['我正确展开了 4 → 3 → 2 → 1 的调用。', '我在基本情况处停止了递归。', '我能按返回的顺序合并结果。'], solution: 'factorial(4) = 4 × factorial(3)\n= 4 × 3 × factorial(2)\n= 4 × 3 × 2 × factorial(1)\n= 4 × 3 × 2 × 1 = 24。\n先调用到基本情况，再逐层返回 1、2、6、24。', hints: ['先找到基本情况：n ≤ 1 时返回 1。', '从 factorial(4) 开始，每次把 n 减少 1。', '先写 4 × factorial(3)，继续展开到 factorial(1)，再逐层相乘。'] },
      { prompt: 'factorial(5) 的返回值是多少？如果把 n − 1 误写成 n，程序会怎样？', rubric: ['我正确计算了 factorial(5)。', '我能解释问题不变小，就无法到达基本情况。', '我知道调用栈最终可能溢出。'], solution: 'factorial(5) = 5 × 24 = 120。\n若改为调用 factorial(n)，对于 n > 1，参数不变、基本情况无法到达，递归会不断继续，最终通常导致调用栈溢出。', hints: ['可以复用上一题 factorial(4) 的结果。', 'factorial(5) = 5 × factorial(4)。', '计算 5 × 24。再思考：如果 n 不减少，什么时候才能到 1？'] }
    ],
    recallQuestions: ['不看资料，说出递归必须具备的两个要素。', '递归调用为什么不能永远传入同样的参数？', '用“统计嵌套文件夹中的文件总数”举例：什么是基本情况，什么是更小的问题？'],
    recallRubric: ['我能说清基本情况和递归步骤。', '我能解释每次调用都要朝基本情况前进。', '我能迁移到新场景：单个文件可直接计数，子文件夹交给更小的同类问题。'],
    recallAnswer: '递归需要基本情况，以及把问题变小的递归步骤。参数不向基本情况靠近，调用可能无法终止。统计文件时，单个文件计为 1，空文件夹计为 0；对每个子文件夹递归统计并求和，就是解决更小的同类问题。'
  }
];
