# Benchmark Challenge v3 -- 29-Task AI Coding Evaluation

Generate a single Python file that implements **all 29** functions and classes listed below.
The file must be valid Python 3.10+ and every item must be defined at the top level.

---

## Category 1: Basic Data Structures

### Task 1 -- MinStack

```python
class MinStack:
    def push(self, val: int) -> None: ...
    def pop(self) -> None: ...
    def top(self) -> int: ...
    def get_min(self) -> int: ...
```

**Rules**

- Every operation must run in O(1) time.
- `top()` returns the element on top without removing it.
- `get_min()` returns the current minimum element.

**Edge cases**

- Pushing duplicate minimums.
- Popping the current minimum reveals the previous minimum.

**Example**

```python
s = MinStack()
s.push(-2); s.push(0); s.push(-3)
assert s.get_min() == -3
s.pop()
assert s.get_min() == -2
assert s.top() == 0
```

---

### Task 2 -- MyQueue (Queue Using Two Stacks)

```python
class MyQueue:
    def push(self, val: int) -> None: ...
    def pop(self) -> int: ...
    def peek(self) -> int: ...
    def empty(self) -> bool: ...
```

**Rules**

- Implement a FIFO queue using only two stacks (Python lists with `append`/`pop`).
- `pop()` removes and returns the front element.
- `peek()` returns the front element without removing it.
- `empty()` returns `True` when the queue has no elements.

**Edge cases**

- Interleaving pushes and pops.
- Calling `peek()` after a sequence of pops.

**Example**

```python
q = MyQueue()
q.push(1); q.push(2)
assert q.peek() == 1
assert q.pop() == 1
assert q.empty() == False
```

---

### Task 3 -- DoublyLinkedList

```python
class DoublyLinkedList:
    def insert_front(self, val: int) -> None: ...
    def insert_back(self, val: int) -> None: ...
    def delete(self, val: int) -> None: ...
    def find(self, val: int) -> bool: ...
    def to_list(self) -> list: ...
```

**Rules**

- `insert_front` adds a node at the head.
- `insert_back` adds a node at the tail.
- `delete` removes the first node whose value equals `val`; no-op if not found.
- `find` returns `True` if `val` exists, `False` otherwise.
- `to_list` returns all values head-to-tail as a Python list.

**Edge cases**

- Deleting from an empty list.
- Deleting the only element.
- Inserting at front and back alternately.

**Example**

```python
dll = DoublyLinkedList()
dll.insert_front(1); dll.insert_back(2); dll.insert_front(0)
assert dll.to_list() == [0, 1, 2]
dll.delete(1)
assert dll.to_list() == [0, 2]
assert dll.find(2) == True
assert dll.find(1) == False
```

---

### Task 4 -- HashMap (Open Addressing)

```python
class HashMap:
    def put(self, key: str, value: Any) -> None: ...
    def get(self, key: str) -> Any: ...       # returns None if key absent
    def remove(self, key: str) -> None: ...
```

**Rules**

- Use open addressing (linear probing or similar) for collision resolution.
- Resize (double capacity) when load factor exceeds 75%.
- `get` returns `None` for missing keys.
- `remove` must handle tombstones or equivalent so that probing still works.

**Edge cases**

- Inserting enough keys to trigger a resize.
- Removing a key and then getting a key that was placed after the removed one in the probe sequence.
- Overwriting an existing key.

**Example**

```python
hm = HashMap()
hm.put("a", 1); hm.put("b", 2)
assert hm.get("a") == 1
hm.remove("a")
assert hm.get("a") is None
hm.put("b", 99)
assert hm.get("b") == 99
```

---

### Task 5 -- PriorityQueue (Min-Heap)

```python
class PriorityQueue:
    def push(self, val: int) -> None: ...
    def pop(self) -> int: ...
    def peek(self) -> int: ...
    def size(self) -> int: ...
```

**Rules**

- Implement a min-heap from scratch (no `heapq`).
- `pop()` removes and returns the smallest element.
- `peek()` returns the smallest element without removing it.
- `size()` returns the number of elements.

**Edge cases**

- Pushing elements in descending order.
- Popping all elements yields a sorted sequence.
- `peek` on a single-element heap.

**Example**

```python
pq = PriorityQueue()
pq.push(5); pq.push(1); pq.push(3)
assert pq.peek() == 1
assert pq.pop() == 1
assert pq.size() == 2
```

---

## Category 2: String Manipulation

### Task 6 -- Run-Length Encoding

```python
def rle_encode(s: str) -> str: ...
def rle_decode(s: str) -> str: ...
```

**Rules**

- Encoding format: count followed by character, e.g. `"aaabbc"` -> `"3a2b1c"`.
- Single-character runs still get a count of 1.
- `rle_decode` reverses the encoding.
- `rle_encode("")` returns `""` and `rle_decode("")` returns `""`.

**Edge cases**

- Single-character string.
- All identical characters.
- Round-trip: `rle_decode(rle_encode(s)) == s` for any `s`.

**Example**

```python
assert rle_encode("aaabbc") == "3a2b1c"
assert rle_decode("3a2b1c") == "aaabbc"
assert rle_encode("") == ""
```

---

### Task 7 -- Balanced Brackets

```python
def is_balanced(s: str) -> bool: ...
```

**Rules**

- Check that `()`, `[]`, and `{}` are correctly nested.
- Ignore any character that is not a bracket.
- An empty string is balanced.

**Edge cases**

- Mixed brackets: `"({[]})"` is balanced.
- Interleaved non-bracket characters: `"a(b)c"` is balanced.
- Mismatched types: `"(]"` is not balanced.

**Example**

```python
assert is_balanced("({[]})") == True
assert is_balanced("([)]") == False
assert is_balanced("hello") == True
```

---

### Task 8 -- Longest Palindromic Substring

```python
def longest_palindrome(s: str) -> str: ...
```

**Rules**

- Return the longest substring of `s` that is a palindrome.
- If there are ties, return any one of them.
- Empty string input returns `""`.

**Edge cases**

- Entire string is a palindrome.
- Single character string.
- Even-length palindromes (`"abba"`).

**Example**

```python
assert longest_palindrome("babad") in ("bab", "aba")
assert longest_palindrome("cbbd") == "bb"
assert longest_palindrome("a") == "a"
```

---

### Task 9 -- Regex Match

```python
def regex_match(text: str, pattern: str) -> bool: ...
```

**Rules**

- `.` matches any single character.
- `*` matches zero or more of the preceding element.
- The match must cover the entire `text` (not partial).
- Do not use the `re` module.

**Edge cases**

- `pattern = ".*"` matches any string.
- `pattern = "a*"` matches `""`.
- `pattern = "a*a"` matches `"a"`.

**Example**

```python
assert regex_match("aa", "a") == False
assert regex_match("aa", "a*") == True
assert regex_match("ab", ".*") == True
assert regex_match("aab", "c*a*b") == True
```

---

### Task 10 -- Calculator

```python
def calc(expr: str) -> float: ...
```

**Rules**

- Support `+`, `-`, `*`, `/` and parentheses `()`.
- Respect standard operator precedence.
- Handle negative numbers (e.g. `"-3+2"`, `"(-1)*2"`).
- Ignore whitespace.
- Division is float division.
- Do **not** use `eval()`, `exec()`, or `ast`.

**Edge cases**

- Nested parentheses: `"((2+3))*4"`.
- Leading negative: `"-1+2"`.
- Spaces everywhere: `" 3 + 4 * 2 "`.

**Example**

```python
assert calc("3+4*2") == 11.0
assert calc("(1+2)*3") == 9.0
assert calc(" -3 + 2 ") == -1.0
```

---

## Category 3: Sorting & Searching

### Task 11 -- Merge Sort

```python
def merge_sort(arr: list[int]) -> list[int]: ...
```

**Rules**

- Return a new sorted list; do not mutate the input.
- Must use the merge-sort algorithm (divide, sort halves, merge).

**Edge cases**

- Empty list.
- Single-element list.
- Already sorted or reverse-sorted input.
- Duplicates.

**Example**

```python
assert merge_sort([5, 3, 1, 4, 2]) == [1, 2, 3, 4, 5]
assert merge_sort([]) == []
```

---

### Task 12 -- Search Range (First and Last Position)

```python
def search_range(arr: list[int], target: int) -> tuple[int, int]: ...
```

**Rules**

- `arr` is sorted in non-decreasing order.
- Return a tuple `(first_index, last_index)` of `target` in `arr`.
- Return `(-1, -1)` if `target` is not found.
- Should run in O(log n) time.

**Edge cases**

- Target appears once.
- Target appears at the very start or end.
- All elements are the same.
- Empty array.

**Example**

```python
assert search_range([5, 7, 7, 8, 8, 10], 8) == (3, 4)
assert search_range([5, 7, 7, 8, 8, 10], 6) == (-1, -1)
assert search_range([], 0) == (-1, -1)
```

---

### Task 13 -- Kth Largest Element

```python
def kth_largest(arr: list[int], k: int) -> int: ...
```

**Rules**

- Return the k-th largest element (1-indexed: k=1 is the largest).
- You may use any algorithm (quickselect, sorting, heap).

**Edge cases**

- k equals the length of the array (return the smallest).
- Duplicates in the array.
- Single-element array with k=1.

**Example**

```python
assert kth_largest([3, 2, 1, 5, 6, 4], 2) == 5
assert kth_largest([3, 2, 3, 1, 2, 4, 5, 5, 6], 4) == 4
```

---

### Task 14 -- Merge K Sorted Lists

```python
def merge_k_sorted(lists: list[list[int]]) -> list[int]: ...
```

**Rules**

- Each inner list is already sorted in non-decreasing order.
- Return a single sorted list containing all elements.
- Handle empty inner lists and an empty outer list.

**Edge cases**

- Some or all inner lists are empty.
- `lists` is `[]`.
- Single inner list.

**Example**

```python
assert merge_k_sorted([[1, 4, 5], [1, 3, 4], [2, 6]]) == [1, 1, 2, 3, 4, 4, 5, 6]
assert merge_k_sorted([]) == []
assert merge_k_sorted([[], [1]]) == [1]
```

---

### Task 15 -- Count Inversions

```python
def count_inversions(arr: list[int]) -> int: ...
```

**Rules**

- An inversion is a pair `(i, j)` with `i < j` and `arr[i] > arr[j]`.
- Return the total count of inversions.
- A merge-sort-based O(n log n) approach is preferred but not required.

**Edge cases**

- Already sorted array (0 inversions).
- Reverse-sorted array (maximum inversions).
- Empty or single-element array.

**Example**

```python
assert count_inversions([2, 4, 1, 3, 5]) == 3
assert count_inversions([1, 2, 3]) == 0
assert count_inversions([3, 2, 1]) == 3
```

---

## Category 4: Dynamic Programming

### Task 16 -- Fibonacci

```python
def fib(n: int) -> int: ...
```

**Rules**

- `fib(0) = 0`, `fib(1) = 1`, `fib(n) = fib(n-1) + fib(n-2)`.
- Must handle `n` up to 100 efficiently (no naive recursion).
- Use memoization or iteration.

**Edge cases**

- `fib(0) == 0`.
- `fib(1) == 1`.
- `fib(100) == 354224848179261915075`.

**Example**

```python
assert fib(0) == 0
assert fib(10) == 55
assert fib(50) == 12586269025
```

---

### Task 17 -- Coin Change

```python
def coin_change(coins: list[int], amount: int) -> int: ...
```

**Rules**

- Return the minimum number of coins needed to make up `amount`.
- Return `-1` if the amount cannot be made.
- Each coin denomination can be used unlimited times.

**Edge cases**

- `amount == 0` returns `0`.
- No valid combination exists.
- Single coin denomination.

**Example**

```python
assert coin_change([1, 5, 10, 25], 30) == 2   # 25 + 5
assert coin_change([2], 3) == -1
assert coin_change([1], 0) == 0
```

---

### Task 18 -- Longest Common Subsequence

```python
def lcs(s1: str, s2: str) -> str: ...
```

**Rules**

- Return the actual longest common subsequence string (not just its length).
- If there are ties, return any valid LCS.
- If there is no common subsequence, return `""`.

**Edge cases**

- One or both strings are empty.
- Strings with no common characters.
- Identical strings.

**Example**

```python
assert lcs("abcde", "ace") == "ace"
assert lcs("abc", "def") == ""
assert lcs("abc", "abc") == "abc"
```

---

### Task 19 -- Edit Distance (Levenshtein)

```python
def edit_distance(s1: str, s2: str) -> int: ...
```

**Rules**

- Allowed operations: insert, delete, replace (each costs 1).
- Return the minimum number of operations to transform `s1` into `s2`.

**Edge cases**

- One or both strings are empty.
- Identical strings (distance 0).
- Completely different strings of equal length.

**Example**

```python
assert edit_distance("kitten", "sitting") == 3
assert edit_distance("", "abc") == 3
assert edit_distance("abc", "abc") == 0
```

---

### Task 20 -- 0/1 Knapsack

```python
def knapsack(weights: list[int], values: list[int], capacity: int) -> int: ...
```

**Rules**

- Each item can be taken at most once.
- Return the maximum total value that fits within `capacity`.
- `weights[i]` and `values[i]` correspond to the same item.

**Edge cases**

- Capacity is 0.
- A single item that fits or does not fit.
- All items fit.

**Example**

```python
assert knapsack([1, 2, 3], [6, 10, 12], 5) == 22   # items 1 and 2
assert knapsack([2, 3, 4, 5], [3, 4, 5, 6], 5) == 7
assert knapsack([10], [100], 5) == 0
```

---

## Category 5: Graph Algorithms

### Task 21 -- BFS Shortest Path

```python
def bfs_shortest(graph: dict, start, end) -> list: ...
```

**Rules**

- `graph` is an adjacency list: `{node: [neighbor, ...], ...}`.
- Return the shortest path from `start` to `end` as a list of nodes including both endpoints.
- Return `[]` if no path exists.
- If `start == end`, return `[start]`.

**Edge cases**

- Start or end node not in graph.
- Disconnected graph.
- Self-loop.

**Example**

```python
g = {"A": ["B", "C"], "B": ["D"], "C": ["D"], "D": []}
assert bfs_shortest(g, "A", "D") in (["A", "B", "D"], ["A", "C", "D"])
assert bfs_shortest(g, "D", "A") == []
assert bfs_shortest(g, "A", "A") == ["A"]
```

---

### Task 22 -- Directed Graph Cycle Detection

```python
def has_cycle(graph: dict) -> bool: ...
```

**Rules**

- `graph` is a directed adjacency list: `{node: [neighbor, ...], ...}`.
- Return `True` if the graph contains at least one cycle, `False` otherwise.

**Edge cases**

- Empty graph.
- Single node with a self-loop.
- DAG (no cycles).
- Multiple disconnected components, one with a cycle.

**Example**

```python
assert has_cycle({"A": ["B"], "B": ["C"], "C": ["A"]}) == True
assert has_cycle({"A": ["B"], "B": ["C"], "C": []}) == False
assert has_cycle({"A": ["A"]}) == True
```

---

### Task 23 -- Topological Sort (Kahn's Algorithm)

```python
def topo_sort(graph: dict) -> list: ...
```

**Rules**

- `graph` is a directed adjacency list: `{node: [neighbor, ...], ...}`.
- Use Kahn's algorithm (BFS-based with in-degree tracking).
- Return a valid topological ordering.
- If the graph contains a cycle, return `[]`.

**Edge cases**

- Empty graph returns `[]`.
- Single node.
- Multiple valid orderings (any valid one is accepted).
- Graph with a cycle.

**Example**

```python
g = {"A": ["B", "C"], "B": ["D"], "C": ["D"], "D": []}
result = topo_sort(g)
assert result.index("A") < result.index("B")
assert result.index("A") < result.index("C")
assert result.index("B") < result.index("D")

assert topo_sort({"A": ["B"], "B": ["A"]}) == []
```

---

## Category 7: Math & Number Theory

### Task 24 -- Sieve of Eratosthenes

```python
def primes_up_to(n: int) -> list[int]: ...
```

**Rules**

- Return all prime numbers up to and including `n` in ascending order.
- Use the Sieve of Eratosthenes algorithm.
- `primes_up_to(1)` returns `[]`.

**Edge cases**

- `n < 2` returns `[]`.
- `n == 2` returns `[2]`.
- Large `n` (should be efficient).

**Example**

```python
assert primes_up_to(10) == [2, 3, 5, 7]
assert primes_up_to(1) == []
assert primes_up_to(2) == [2]
```

---

### Task 25 -- GCD and LCM

```python
def gcd(a: int, b: int) -> int: ...
def lcm(a: int, b: int) -> int: ...
```

**Rules**

- Use the Euclidean algorithm for `gcd`.
- `lcm(a, b) = abs(a * b) // gcd(a, b)` when both are nonzero.
- Handle zero inputs: `gcd(0, n) == n`, `gcd(0, 0) == 0`.
- `lcm(0, n) == 0`.

**Edge cases**

- One or both arguments are zero.
- Negative inputs (treat as absolute values).
- Equal inputs.

**Example**

```python
assert gcd(12, 8) == 4
assert lcm(4, 6) == 12
assert gcd(0, 5) == 5
assert lcm(0, 5) == 0
```

---

### Task 26 -- Matrix Multiplication

```python
def mat_mul(a: list[list[int]], b: list[list[int]]) -> list[list[int]]: ...
```

**Rules**

- Standard matrix multiplication: result dimensions are `(rows_a x cols_b)`.
- Assume dimensions are compatible (cols of `a` == rows of `b`).
- Return a new 2D list.

**Edge cases**

- 1x1 matrices.
- Non-square matrices.
- Identity matrix multiplication.

**Example**

```python
assert mat_mul([[1, 2], [3, 4]], [[5, 6], [7, 8]]) == [[19, 22], [43, 50]]
assert mat_mul([[2]], [[3]]) == [[6]]
```

---

## Category 9: Simulation

### Task 27 -- Conway's Game of Life (One Step)

```python
def life_step(grid: list[list[int]]) -> list[list[int]]: ...
```

**Rules**

- `grid` contains `0` (dead) and `1` (alive) cells.
- Apply the standard rules for one generation:
  - Live cell with 2 or 3 live neighbors survives.
  - Dead cell with exactly 3 live neighbors becomes alive.
  - All other cells die or stay dead.
- Neighbors include all 8 surrounding cells (out-of-bounds counts as dead).
- Return a new grid; do not mutate the input.

**Edge cases**

- Empty grid or grid with one cell.
- All dead or all alive.
- Stable patterns (e.g. a 2x2 block).

**Example**

```python
grid = [
    [0, 1, 0],
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
]
expected = [
    [0, 0, 0],
    [1, 0, 1],
    [0, 1, 1],
    [0, 1, 0],
]
assert life_step(grid) == expected
```

---

### Task 28 -- Flood Fill

```python
def flood_fill(grid: list[list[int]], row: int, col: int, new_color: int) -> list[list[int]]: ...
```

**Rules**

- Starting from `(row, col)`, change the color of the connected region (4-directional: up, down, left, right) to `new_color`.
- Connected region = all cells reachable from the start that share the same original color.
- Return a new grid; do not mutate the input.
- If the starting cell already equals `new_color`, return a copy of the grid unchanged.

**Edge cases**

- Start color equals new color (no-op).
- Single-cell grid.
- Entire grid is one color.

**Example**

```python
grid = [
    [1, 1, 1],
    [1, 1, 0],
    [1, 0, 1],
]
expected = [
    [2, 2, 2],
    [2, 2, 0],
    [2, 0, 1],
]
assert flood_fill(grid, 0, 0, 2) == expected
```

---

## Category 10: Utilities

### Task 29 -- Base Conversion

```python
def convert_base(num_str: str, from_base: int, to_base: int) -> str: ...
```

**Rules**

- Convert `num_str` from `from_base` to `to_base`.
- Bases range from 2 to 36.
- Use digits `0-9` and uppercase letters `A-Z` for bases above 10.
- Accept both upper- and lowercase input; output must be uppercase.
- Handle `"0"` correctly.

**Edge cases**

- `num_str` is `"0"`.
- Binary to hexadecimal.
- Base 10 to base 10 (identity).
- Maximum base (36).

**Example**

```python
assert convert_base("FF", 16, 10) == "255"
assert convert_base("10", 2, 10) == "2"
assert convert_base("255", 10, 16) == "FF"
assert convert_base("0", 10, 2) == "0"
```

---

## Global Rules

1. **Allowed imports** -- only these may appear anywhere in the file:
   ```python
   from collections import deque, defaultdict
   from typing import Any, Optional
   ```
2. **Forbidden** -- do not use `eval()`, `exec()`, `ast`, `heapq`, `re`, or any external / third-party library.
3. **File structure** -- all functions and classes must be defined at the top level of a single `.py` file.
4. **Python version** -- the file must be valid Python 3.10+.
