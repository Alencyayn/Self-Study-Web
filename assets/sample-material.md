# Vector Spaces

Understand, prove and apply the key ideas of vector spaces, one small step at a time.

## 4.3 — Basis

Core question: When does a set of vectors form a basis for a space?

### THE KEY IDEA

A **basis** is a set of vectors that satisfies two conditions: it is **linearly independent**, and it **spans the entire space**.

Think of it as the smallest complete coordinate language. Every vector in the space has exactly one expression in that language.

$$
\mathcal{B}=\{v_1,v_2,\ldots,v_n\}
$$

Nothing extra, nothing missing. Remove a vector and the set no longer spans the space. Add another and the set is no longer independent.

### WORKED EXAMPLE

Consider $v_1=(1,0)$ and $v_2=(0,1)$ in $\mathbb{R}^2$.

1. Every $(x,y)$ can be written as $xv_1+yv_2$, so the vectors span $\mathbb{R}^2$.
2. If $av_1+bv_2=0$, then $(a,b)=(0,0)$, so the vectors are linearly independent.
3. Both conditions hold. Therefore $\{v_1,v_2\}$ is a basis for $\mathbb{R}^2$.

### QUICK CHECK

Is $\{(1,0),(1,1)\}$ a basis for $\mathbb{R}^2$? Check both spanning and linear independence, and explain your reasoning.

### ANSWER

Yes. Every $(x,y)=(x-y)(1,0)+y(1,1)$, so the set spans the plane. If $a(1,0)+b(1,1)=(0,0)$, then $b=0$ and $a=0$, so it is linearly independent.

## 4.4 — Coordinates

Core question: How can the same vector have different coordinate vectors?

### THE KEY IDEA

Once you choose an ordered basis, a **coordinate vector** records the coefficients used to express a vector in that basis.

$$
v=c_1b_1+\cdots+c_nb_n
\qquad\Longrightarrow\qquad
[v]_{\mathcal{B}}=\begin{bmatrix}c_1\\\vdots\\c_n\end{bmatrix}
$$

The vector has not changed, only the language used to describe it. Order matters: the first coordinate belongs to the first basis vector.

### WORKED EXAMPLE

Let $\mathcal{B}=\{(1,1),(1,-1)\}$. Find the coordinate vector of $v=(4,2)$.

1. Write $v=c_1(1,1)+c_2(1,-1)$.
2. Compare components: $c_1+c_2=4$ and $c_1-c_2=2$.
3. Solve to get $c_1=3$ and $c_2=1$. Thus $[v]_{\mathcal{B}}=(3,1)$ describes the same vector as the standard coordinates $(4,2)$.

### QUICK CHECK

Using the same basis $\mathcal{B}=\{(1,1),(1,-1)\}$, find the coordinates of $(2,4)$. Substitute your result to check it.

### ANSWER

Solving $c_1+c_2=2$ and $c_1-c_2=4$ gives $c_1=3$ and $c_2=-1$. The coordinate vector is $(3,-1)$. Check: $3(1,1)-(1,-1)=(2,4)$.

## 4.5 — Dimension & Linear Independence

Core question: Why can a space not have more independent vectors than its dimension?

### THE KEY IDEA

If $\mathcal{B}$ is a basis for $V$ with $n$ vectors, every vector has an $n$-entry coordinate vector:

$$
[v]_{\mathcal{B}}\in\mathbb{R}^n
$$

This lets us turn an independence question in a general vector space into a matrix problem.

Arrange $m$ coordinate vectors as columns of an $n\times m$ matrix. If $m>n$, not every column can contain a pivot. The homogeneous system has a free variable, so the vectors are linearly dependent.

### WORKED EXAMPLE

The standard basis of $P_2$ is $\{1,t,t^2\}$. The space has dimension $3$.

1. Every polynomial corresponds to a coordinate vector with $3$ entries.
2. The coordinates of $4$ polynomials form a $3\times4$ matrix when arranged as columns.
3. There can be at most $3$ pivots, so there is at least one free variable.
4. Any $4$ polynomials in $P_2$ must therefore be linearly dependent.

### QUICK CHECK

The standard basis of $P_3$ is:

$$
\mathcal{B}=\{1,t,t^2,t^3\}
$$

Arrange the coordinate vectors of **6 polynomials** as the columns of a matrix.

**How many rows and columns does it have, and why? Can its columns be linearly independent?**

### ANSWER

It is a $4\times6$ matrix. Every coordinate vector has $4$ entries, giving $4$ rows. The $6$ polynomials give $6$ columns. There can be at most $4$ pivots, leaving at least $2$ free variables, so the columns cannot be linearly independent.
