# Vector Spaces

独立理解、证明和应用 Vector Spaces 的重要定理。

## 4.3 — Basis

核心问题：一组 vectors，怎样才能成为一个空间的 basis？

### THE KEY IDEA

一个 vector space 的 **basis（基）**，是一组同时满足两个条件的向量：**linearly independent**，并且 **span 整个空间**。

它像一套最精简的坐标语言：每一个向量都能用它表示，而且表示方式只有一种。

$$
\mathcal{B}=\{v_1,v_2,\ldots,v_n\}
$$

不多一个，也不少一个。移除其中一个向量，就无法再表示整个空间；增加一个向量，则不再线性无关。

### WORKED EXAMPLE

考虑 $\mathbb{R}^2$ 中的两个向量 $v_1=(1,0)$ 和 $v_2=(0,1)$。

1. 任意 $(x,y)$ 都能写成 $xv_1+yv_2$，所以它们 span 整个 $\mathbb{R}^2$。
2. 若 $av_1+bv_2=0$，则 $(a,b)=(0,0)$，因此它们 linearly independent。
3. 两个条件同时满足，所以 $\{v_1,v_2\}$ 是 $\mathbb{R}^2$ 的一组 basis。

### QUICK CHECK

向量组 $\{(1,0),(1,1)\}$ 是 $\mathbb{R}^2$ 的一组 basis 吗？请分别检查 spanning 和 linear independence，并说明为什么。

### ANSWER

是。任意 $(x,y)=(x-y)(1,0)+y(1,1)$，因此它们 span 整个平面。若 $a(1,0)+b(1,1)=(0,0)$，则 $b=0$ 且 $a=0$，所以线性无关。

## 4.4 — Coordinates

核心问题：同一个向量，为什么可以有不同的 coordinate vector？

### THE KEY IDEA

选定一组 basis 后，一个向量的 **coordinate vector（坐标向量）**，记录的是它由各个基向量组成时的系数。

$$
v=c_1b_1+\cdots+c_nb_n
\qquad\Longrightarrow\qquad
[v]_{\mathcal{B}}=\begin{bmatrix}c_1\\\vdots\\c_n\end{bmatrix}
$$

向量本身没有改变，改变的是描述它的坐标语言。顺序也很重要：坐标的第一个分量，总是对应 basis 中的第一个向量。

### WORKED EXAMPLE

取 $\mathcal{B}=\{(1,1),(1,-1)\}$，求 $v=(4,2)$ 的坐标向量。

1. 写成 $v=c_1(1,1)+c_2(1,-1)$。
2. 比较两个分量：$c_1+c_2=4$，$c_1-c_2=2$。
3. 解得 $c_1=3$，$c_2=1$。所以 $[v]_{\mathcal{B}}=(3,1)$，它与标准坐标 $(4,2)$ 描述的是同一个向量。

### QUICK CHECK

在相同 basis $\mathcal{B}=\{(1,1),(1,-1)\}$ 下，求 $(2,4)$ 的坐标向量，并代回检查。

### ANSWER

由 $c_1+c_2=2$、$c_1-c_2=4$，得到 $c_1=3$、$c_2=-1$。所以坐标向量为 $(3,-1)$。检验：$3(1,1)-(1,-1)=(2,4)$。

## 4.5 — Dimension & Linear Independence

核心问题：为什么一个空间不可能拥有超过其维度数量的 independent vectors？

### THE KEY IDEA

如果 $\mathcal{B}$ 是 $V$ 的 basis，且包含 $n$ 个 vectors，那么每个 vector 都有一个 $n$-entry coordinate vector：

$$
[v]_{\mathcal{B}}\in\mathbb{R}^n
$$

这使我们能够把一般 Vector Space 的 independence 问题转化为矩阵问题。

把 $m$ 个 coordinate vectors 按列排列，得到一个 $n\times m$ 的矩阵。若 $m>n$，每列不可能都有 pivot，因此齐次方程存在自由变量，这些 vectors 必然 linearly dependent。

### WORKED EXAMPLE

在 $P_2$ 中，standard basis 为 $\{1,t,t^2\}$，空间维度为 $3$。

1. 每个 polynomial 都对应一个含 $3$ 个分量的坐标向量。
2. 把 $4$ 个 polynomials 的坐标按列排列，得到 $3\times4$ 的矩阵。
3. 最多只能有 $3$ 个 pivots，至少有一个 free variable。
4. 所以任何 $4$ 个 $P_2$ 中的 polynomials 都 linearly dependent。

### QUICK CHECK

已知 $P_3$ 的 standard basis：

$$
\mathcal{B}=\{1,t,t^2,t^3\}
$$

如果将 **6 个 polynomials** 的 coordinate vectors 排列为一个 matrix：

**这个 matrix 是几行几列？为什么？它的 columns 能 linearly independent 吗？**

### ANSWER

矩阵是 $4\times6$：每个坐标向量有 $4$ 个 entries，对应 $4$ 行；$6$ 个 polynomials 对应 $6$ 列。最多有 $4$ 个 pivots，所以至少有 $2$ 个 free variables，columns 不可能 linearly independent。
