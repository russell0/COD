from collections import deque, defaultdict
from typing import Any, Optional

# --- Task 1: MinStack (O(1) operations) ---
class MinStack:
    def __init__(self):
        # Stack for values
        self.stack: list[int] = []
        # Stack for minimums at each level
        self.min_stack: list[int] = []

    def push(self, val: int) -> None:
        self.stack.append(val)
        if not self.min_stack or val <= self.min_stack[-1]:
            self.min_stack.append(val)
        else:
            self.min_stack.append(self.min_stack[-1])

    def pop(self) -> None:
        if not self.stack:
            raise IndexError("pop from empty stack")
        self.stack.pop()
        self.min_stack.pop()

    def top(self) -> int:
        if not self.stack:
            raise IndexError("top from empty stack")
        return self.stack[-1]

    def get_min(self) -> int:
        if not self.min_stack:
            raise IndexError("get_min from empty stack")
        return self.min_stack[-1]

# --- Task 2: MyQueue (Queue Using Two Stacks) ---
class MyQueue:
    def __init__(self):
        self.stack1: list[int] = []  # For pushing
        self.stack2: list[int] = []  # For popping/peeking

    def push(self, val: int) -> None:
        self.stack1.append(val)

    def _transfer(self):
        if not self.stack2:
            while self.stack1:
                self.stack2.append(self.stack1.pop())
        # Now stack2 has elements in reverse order of insertion, ready for FIFO pop
        self.stack2.reverse()

    def pop(self) -> int:
        self._transfer()
        if not self.stack2:
            raise IndexError("pop from empty queue")
        return self.stack2.pop()

    def peek(self) -> int:
        self._transfer()
        if not self.stack2:
            raise IndexError("peek from empty queue")
        return self.stack2[-1]

    def empty(self) -> bool:
        return not self.stack1 and not self.stack2

# --- Task 3: DoublyLinkedList ---
class DoublyLinkedList:
    class Node:
        def __init__(self, val: int):
            self.val = val
            self.prev: Optional[DoublyLinkedList.Node] = None
            self.next: Optional[DoublyLinkedList.Node] = None

    def __init__(self):
        self.head: Optional[DoublyLinkedList.Node] = None
        self.tail: Optional[DoublyLinkedList.Node] = None

    def insert_front(self, val: int) -> None:
        new_node = self.Node(val)
        if not self.head:
            self.head = new_node
            self.tail = new_node
        else:
            new_node.next = self.head
            self.head.prev = new_node
            self.head = new_node

    def insert_back(self, val: int) -> None:
        new_node = self.Node(val)
        if not self.tail:
            self.head = new_node
            self.tail = new_node
        else:
            new_node.prev = self.tail
            self.tail.next = new_node
            self.tail = new_node

    def delete(self, val: int) -> None:
        if not self.head:
            return

        current = self.head
        while current:
            if current.val == val:
                # Delete node
                if current == self.head:
                    self.head = current.next
                    if self.head:
                        self.head.prev = None
                    else:
                        self.tail = None
                elif current == self.tail:
                    self.tail = current.prev
                    if self.tail:
                        self.tail.next = None
                    else:
                        self.head = None
                else:
                    current.prev.next = current.next
                    current.next.prev = current.prev
                return
            current = current.next

    def find(self, val: int) -> bool:
        current = self.head
        while current:
            if current.val == val:
                return True
            current = current.next
        return False

    def to_list(self) -> list[int]:
        result = []
        current = self.head
        while current:
            result.append(current.val)
            current = current.next
        return result

# --- Task 4: HashMap (Open Addressing) ---
class HashMap:
    def __init__(self, initial_capacity: int = 16):
        self.capacity = initial_capacity
        # Store key-value pairs. Use None for empty/deleted slots (tombstones).
        self.table: list[Optional[tuple[str, Any]]] = [None] * self.capacity
        self.size = 0
        self.tombstone_count = 0

    def _hash(self, key: str) -> int:
        return hash(key) % self.capacity

    def _resize(self):
        old_table = self.table
        self.capacity *= 2
        self.table = [None] * self.capacity
        self.size = 0
        self.tombstone_count = 0

        for item in old_table:
            if item is not None and item[0] != "DELETED":
                self.put(item[0], item[1])

    def put(self, key: str, value: Any) -> None:
        if self.size / self.capacity > 0.75:
            self._resize()

        start_index = self._hash(key)
        i = start_index
        first_tombstone_index: Optional[int] = None

        while True:
            slot = self.table[i]
            if slot is None:
                # Found an empty slot, insert here if no tombstone was found earlier in probe sequence
                if first_tombstone_index is None:
                    self.size += 1
                    self.table[i] = (key, value)
                    return
            elif slot[0] == "DELETED":
                # Found a tombstone, record it as the potential insertion spot if we haven't found an empty slot yet
                if first_tombstone_index is None:
                    first_tombstone_index = i
            elif slot[0] == key:
                # Key already exists, update value
                self.table[i] = (key, value)
                return
            else:
                # Collision, continue probing
                if first_tombstone_index is not None and i == first_tombstone_index:
                    # Insert into the tombstone slot
                    self.table[i] = (key, value)
                    self.size += 1 # Size doesn't change for update/re-insertion in this context if we consider it an overwrite
                    return
                i = (i + 1) % self.capacity
                if i == start_index:
                    # Full circle without finding a spot, should have resized earlier or logic error.
                    # Since resize is triggered by load factor, this path implies a full table if no empty/tombstone found.
                    # Given the resize logic, this shouldn't happen unless capacity is too small relative to size.
                    break 
        
    def get(self, key: str) -> Any:
        start_index = self._hash(key)
        i = start_index
        while True:
            slot = self.table[i]
            if slot is None:
                return None  # Key not found
            elif slot[0] == key:
                return slot[1]  # Found
            i = (i + 1) % self.capacity
            if i == start_index:
                return None # Full circle checked

    def remove(self, key: str) -> None:
        start_index = self._hash(key)
        i = start_index
        while True:
            slot = self.table[i]
            if slot is None:
                return  # Key not found
            elif slot[0] == key:
                # Mark as deleted (tombstone)
                self.table[i] = ("DELETED", None)
                self.size -= 1 # Decrement size only if it was a valid entry before deletion
                return
            i = (i + 1) % self.capacity
            if i == start_index:
                return

# --- Task 5: PriorityQueue (Min-Heap) ---
class PriorityQueue:
    def __init__(self):
        self.heap: list[int] = []

    def _sift_up(self, index: int):
        while index > 0 and self.heap[index] < self.heap[(index - 1) // 2]:
            self.heap[index], self.heap[(index - 1) // 2] = self.heap[(index - 1) // 2], self.heap[index]
            index = (index - 1) // 2

    def _sift_down(self, index: int):
        n = len(self.heap)
        while True:
            left = 2 * index + 1
            right = 2 * index + 2
            smallest = index

            if left < n and self.heap[left] < self.heap[smallest]:
                smallest = left
            if right < n and self.heap[right] < self.heap[smallest]:
                smallest = right

            if smallest != index:
                self.heap[index], self.heap[smallest] = self.heap[smallest], self.heap[index]
                index = smallest
            else:
                break

    def push(self, val: int) -> None:
        self.heap.append(val)
        self._sift_up(len(self.heap) - 1)

    def pop(self) -> int:
        if not self.heap:
            raise IndexError("pop from empty priority queue")
        if len(self.heap) == 1:
            return self.heap.pop()
        
        min_val = self.heap[0]
        self.heap[0] = self.heap.pop()
        self._sift_down(0)
        return min_val

    def peek(self) -> int:
        if not self.heap:
            raise IndexError("peek from empty priority queue")
        return self.heap[0]

    def size(self) -> int:
        return len(self.heap)

# --- Task 6: Run-Length Encoding ---
def rle_encode(s: str) -> str:
    if not s:
        return ""
    encoded = []
    i = 0
    n = len(s)
    while i < n:
        char = s[i]
        count = 1
        j = i + 1
        while j < n and s[j] == char:
            count += 1
            j += 1
        encoded.append(str(count) + char)
        i = j
    return "".join(encoded)

def rle_decode(s: str) -> str:
    if not s:
        return ""
    
    decoded = []
    i = 0
    n = len(s)
    while i < n:
        # Read count (can be multi-digit)
        count_str = ""
        j = i
        while j < n and s[j].isdigit():
            count_str += s[j]
            j += 1
        
        if not count_str: # Should not happen if input is valid RLE format
            i += 1
            continue

        count = int(count_str)
        
        # Read character
        if j < n:
            char = s[j]
            decoded.append(char * count)
            i = j + 1
        else:
            # Error in format if we read a number but no character follows
            break

    return "".join(decoded)

# --- Task 7: Balanced Brackets ---
def is_balanced(s: str) -> bool:
    stack = []
    mapping = {")": "(", "]": "[", "}": "{"}
    
    for char in s:
        if char in "([{":
            stack.append(char)
        elif char in ")]}":
            if not stack or stack[-1] != mapping[char]:
                return False
            stack.pop()
        # Ignore other characters

    return not stack

# --- Task 8: Longest Palindromic Substring ---
def longest_palindrome(s: str) -> str:
    n = len(s)
    if n < 2:
        return s if n == 1 else ""

    start = 0
    max_len = 1

    for i in range(n):
        for j in range(i, n):
            substring = s[i:j+1]
            if substring == substring[::-1]:
                if len(substring) > max_len:
                    max_len = len(substring)
                    start = i
    
    return s[start:start + max_len]

# --- Task 9: Regex Match (Manual Implementation) ---
def regex_match(text: str, pattern: str) -> bool:
    n = len(text)
    m = len(pattern)
    
    if m == 0:
        return n == 0
    
    # Handle the case where pattern starts with .*
    if m > 2 and pattern[:2] == ".*":
        # If pattern is .* followed by the rest, it matches everything if the rest is valid.
        # Since we must match the *entire* text, this simplifies to checking if the rest of the pattern can be matched.
        # For simplicity in manual implementation without full regex engine, we rely on the standard interpretation: 
        # .* matches zero or more characters. If the pattern is just ".*", it matches everything (n>=0).
        if m == 2 and pattern[2:] == "": # Pattern is ".*"
            return True
        # For complex patterns like "a*b", we must proceed with manual matching logic below.

    i = 0  # index for text
    j = 0  # index for pattern
    
    while i < n:
        # Check if the current position matches the pattern character
        if j < m and (pattern[j] == '.' or pattern[j] == text[i]):
            i += 1
            j += 1
        else:
            # Mismatch or end of pattern reached before end of text
            return False

    # The match must cover the entire text. If we reached the end of text (i==n), 
    # we must also have reached the end of the pattern (j==m) for a full match, unless .* was involved.
    if j < m:
        # This handles cases like "abc" vs "a" where 'c' is left unmatched.
        return False

    # Special handling for patterns ending in '*' which can match zero characters at the end of text
    # The rules state: "The match must cover the entire text". 
    # If pattern=".*", it matches everything, so if we reached i=n and j<m (e.g., pattern=".*a" vs text="b"), this is False.
    # The loop structure above naturally enforces that all of 'text' was consumed by the pattern.
    return True


# --- Task 10: Calculator ---
def calc(expr: str) -> float:
    # Simple implementation using shunting-yard concept implicitly via two stacks (values and operators)
    tokens = []
    i = 0
    n = len(expr)
    
    # Tokenize: numbers, operators, parentheses
    while i < n:
        if expr[i].isspace():
            i += 1
            continue
        
        if expr[i].isdigit() or (expr[i] == '-' and (i == 0 or expr[i-1] in '(*+-.')):
            # Handle negative numbers correctly at the start or after an operator
            start = i
            if expr[i] == '-':
                # If it's a unary minus, treat it as part of the number
                j = i + 1
                while j < n and expr[j].isdigit():
                    j += 1
                num_str = expr[i:j]
            else:
                # Regular number
                j = i
                while j < n and (expr[j].isdigit() or expr[j] == '.'):
                    j += 1
                num_str = expr[i:j]
        else:
            # Operator or parenthesis
            num_str = expr[i]
            j = i + 1
            while j < n and not (expr[j].isdigit() or expr[j] == '.'):
                j += 1
            num_str = expr[i:j]

        if num_str:
            tokens.append(float(num_str))
        
        if i < n:
            # Check if the current token is an operator or parenthesis
            if expr[i] in "+-*/()":
                tokens.append(expr[i])
            i += 1

    # Evaluation using two stacks (values and operators) - simplified for this context
    values = []
    ops = []
    
    def apply_op():
        op = ops.pop()
        right = values.pop()
        left = values.pop()
        if op == '+':
            values.append(left + right)
        elif op == '-':
            values.append(left - right)
        elif op == '*':
            values.append(left * right)
        elif op == '/':
            # Division truncates toward zero (as per requirement)
            values.append(int(left / right))
        else:
            raise ValueError("Unknown operator")

    for token in tokens:
        if isinstance(token, float):
            values.append(token)
        elif token == '(':
            ops.append(token)
        elif token == ')':
            while ops[-1] != '(':
                apply_op()
            ops.pop() # Pop '('
        elif token in "+-*/":
            # Handle unary minus: if the previous item on the stack is an operator or '('
            if (not values) or (values[-1] in '+-*/('):
                 # If we see a unary minus, push 0 to handle it as part of the number
                values.append(0.0)
            ops.append(token)
        else:
            # Should not happen if tokenization is perfect, but for safety:
            pass

    while ops:
        apply_op()

    if len(values) == 1:
        return values[0]
    else:
        # This path indicates an error in expression parsing or structure.
        # For the scope of this challenge, we assume valid input leads to a single result.
        raise ValueError("Invalid expression format")


# --- Task 11: Merge Sort ---
def merge_sort(arr: list[int]) -> list[int]:
    if len(arr) <= 1:
        return arr[:]
    
    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])
    
    return merge(left, right)

def merge(left: list[int], right: list[int]) -> list[int]:
    result = []
    i = 0
    j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            result.append(left[i])
            i += 1
        else:
            result.append(right[j])
            j += 1
    result.extend(left[i:])
    result.extend(right[j:])
    return result

# --- Task 12: Search Range (First and Last Position) ---
def search_range(arr: list[int], target: int) -> tuple[int, int]:
    if not arr:
        return (-1, -1)

    # Find first occurrence (lower bound)
    first = -1
    low, high = 0, len(arr) - 1
    while low <= high:
        mid = (low + high) // 2
        if arr[mid] >= target:
            first = mid
            high = mid - 1
        else:
            low = mid + 1

    if first == -1 or arr[first] != target:
        return (-1, -1)

    # Find last occurrence (upper bound)
    last = -1
    low, high = 0, len(arr) - 1
    while low <= high:
        mid = (low + high) // 2
        if arr[mid] <= target:
            last = mid
            low = mid + 1
        else:
            high = mid - 1

    return (last, first)


# --- Task 13: Kth Largest Element ---
def kth_largest(arr: list[int], k: int) -> int:
    if not arr or k <= 0 or k > len(arr):
        raise ValueError("Invalid k or array")
    
    # Use sorting (simplest, O(N log N)) as allowed by rules.
    # For better performance on large arrays, Quickselect (O(N) average) would be used.
    sorted_arr = sorted(arr, reverse=True)
    return sorted_arr[k - 1]

# --- Task 14: Merge K Sorted Lists ---
def merge_k_sorted(lists: list[list[int]]) -> list[int]:
    if not lists:
        return []

    result = []
    # Initialize a heap with (value, list_index, element_index) for all lists
    heap = []
    for i, lst in enumerate(lists):
        if lst:
            # Push the first element of each non-empty list
            heap.append((lst[0], i, 0))

    while heap:
        val, list_idx, element_idx = heapq.heappop(heap)
        result.append(val)
        
        current_list = lists[list_idx]
        next_element_idx = element_idx + 1
        
        if next_element_idx < len(current_list):
            heap.append((current_list[next_element_idx], list_idx, next_element_idx))

    return result


# --- Task 15: Count Inversions (Merge Sort based) ---
def count_inversions(arr: list[int]) -> int:
    if len(arr) <= 1:
        return 0
    
    # Helper function to merge and count inversions
    def merge_and_count(arr_slice: list[int]) -> tuple[list[int], int]:
        n = len(arr_slice)
        if n <= 1:
            return arr_slice, 0

        mid = n // 2
        left, inv_left = merge_and_count(arr_slice[:mid])
        right, inv_right = merge_and_count(arr_slice[mid:])
        
        merged = []
        inv = inv_left + inv_right
        i = 0
        j = 0
        
        while i < len(left) and j < len(right):
            if left[i] <= right[j]:
                merged.append(left[i])
                i += 1
            else:
                # Inversion found: all remaining elements in left are greater than right[j]
                merged.append(right[j])
                inv += (len(left) - i)
                j += 1
        
        merged.extend(left[i:])
        merged.extend(right[j:])
        
        return merged, inv

    _, total_inversions = merge_and_count(arr)
    return total_inversions


# --- Task 16: Fibonacci (Iterative) ---
def fib(n: int) -> int:
    if n < 0:
        raise ValueError("Input must be non-negative")
    if n == 0:
        return 0
    if n == 1:
        return 1
    
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b

# --- Task 17: Coin Change (DP) ---
def coin_change(coins: list[int], amount: int) -> int:
    if amount == 0:
        return 0
    
    # dp[i] will store the minimum number of coins to make up amount i
    # Initialize with amount + 1 (representing infinity)
    dp = [amount + 1] * (amount + 1)
    dp[0] = 0

    for i in range(1, amount + 1):
        for coin in coins:
            if i >= coin:
                # If we use this coin, the number of coins is 1 + dp[i - coin]
                dp[i] = min(dp[i], 1 + dp[i - coin])

    result = dp[amount]
    return result if result <= amount else -1


# --- Task 18: Longest Common Subsequence (LCS) ---
def lcs(s1: str, s2: str) -> str:
    m = len(s1)
    n = len(s2)
    
    # dp[i][j] stores the length of LCS of s1[:i] and s2[:j]
    dp = [[0] * (n + 1) for _ in range(m + 1)]

    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if s1[i - 1] == s2[j - 1]:
                dp[i][j] = 1 + dp[i - 1][j - 1]
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])

    # Backtrack to find the actual LCS string
    lcs_str = []
    i, j = m, n
    while i > 0 and j > 0:
        if s1[i - 1] == s2[j - 1]:
            lcs_str.append(s1[i - 1])
            i -= 1
            j -= 1
        elif dp[i - 1][j] > dp[i][j - 1]:
            i -= 1
        else:
            j -= 1

    return "".join(reversed(lcs_str))


# --- Task 19: Edit Distance (Levenshtein) ---
def edit_distance(s1: str, s2: str) -> int:
    if len(s1) < len(s2):
        return edit_distance(s2, s1) # Ensure s1 is the longer string for optimization

    m = len(s1)
    n = len(s2)

    # dp[i][j] is the edit distance between s1[:i] and s2[:j]
    dp = [[0] * (n + 1) for _ in range(m + 1)]

    # Initialize first row and column
    for i in range(m + 1):
        dp[i][0] = i  # Deletions
    for j in range(n + 1):
        dp[0][j] = j  # Insertions

    # Fill the DP table
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            cost = 0 if s1[i - 1] == s2[j - 1] else 1
            dp[i][j] = min(dp[i - 1][j] + 1,        # Deletion
                          dp[i][j - 1] + 1,        # Insertion
                          dp[i - 1][j - 1] + cost) # Substitution or Match

    return dp[m][n]

# --- Task 20: 0/1 Knapsack (DP) ---
def knapsack(weights: list[int], values: list[int], capacity: int) -> int:
    n = len(weights)
    if n == 0 or capacity == 0:
        return 0

    # dp[i][w] is the max value using first i items with capacity w
    dp = [[0] * (capacity + 1) for _ in range(n + 1)]

    for i in range(1, n + 1):
        weight_i = weights[i - 1]
        value_i = values[i - 1]
        for w in range(capacity + 1):
            if w >= weight_i:
                # Option 1: Include item i
                include_val = value_i + dp[i - 1][w - weight_i]
                # Option 2: Exclude item i
                exclude_val = dp[i - 1][w]
                dp[i][w] = max(include_val, exclude_val)
            else:
                # Cannot include item i, so value is same as excluding it
                dp[i][w] = dp[i - 1][w]

    return dp[n][capacity]

# --- Task 21: BFS Shortest Path ---
def bfs_shortest(graph: dict, start, end) -> list:
    if start == end:
        return [start]
    
    queue = deque([(start, [start])])  # (current_node, path_so_far)
    visited = {start}

    while queue:
        current, path = queue.popleft()

        for neighbor in graph.get(current, []):
            if neighbor == end:
                return path + [neighbor]
            if neighbor not in visited:
                visited.add(neighbor)
                new_path = path + [neighbor]
                queue.append((neighbor, new_path))

    return [] # No path found


# --- Task 22: Directed Graph Cycle Detection (DFS based) ---
def has_cycle(graph: dict) -> bool:
    visited = {}  # 0: unvisited, 1: visiting (in current recursion stack), 2: visited (finished processing)
    
    for node in graph:
        visited[node] = 0

    def dfs(u):
        visited[u] = 1  # Mark as visiting (in recursion stack)
        
        for v in graph.get(u, []):
            if visited[v] == 1:
                return True  # Cycle detected (back edge to a node currently being visited)
            if visited[v] == 0:
                if dfs(v):
                    return True
            # If visited[v] == 2, it's a cross edge or forward edge to an already finished component, no cycle here.

        visited[u] = 2  # Mark as visited (finished processing)
        return False

    for node in graph:
        if visited[node] == 0:
            if dfs(node):
                return True
    
    return False


# --- Task 23: Topological Sort (Kahn's Algorithm) ---
def topo_sort(graph: dict) -> list:
    in_degree = defaultdict(int)
    all_nodes = set(graph.keys())
    
    # Initialize in-degrees for all nodes, including those with no outgoing edges
    for u in graph:
        for v in graph[u]:
            in_degree[v] += 1
            all_nodes.add(v)

    # Ensure all nodes are in the in_degree map, even if they have 0 in-degree initially
    for node in all_nodes:
        if node not in in_degree:
            in_degree[node] = 0

    queue = deque()
    
    # Start with nodes having an in-degree of 0
    for node in all_nodes:
        if in_degree[node] == 0:
            queue.append(node)

    topological_order = []
    
    while queue:
        u = queue.popleft()
        topological_order.append(u)

        for v in graph.get(u, []):
            in_degree[v] -= 1
            if in_degree[v] == 0:
                queue.append(v)

    # Check for cycle: if the number of nodes in the order is less than total nodes, there was a cycle.
    if len(topological_order) != len(all_nodes):
        return [] # Cycle detected
    
    return topological_order


# --- Task 24: Sieve of Eratosthenes ---
def primes_up_to(n: int) -> list[int]:
    if n < 2:
        return []
    
    # Initialize is_prime array
    is_prime = [True] * (n + 1)
    is_prime[0] = is_prime[1] = False
    
    p = 2
    while p * p <= n:
        if is_prime[p]:
            # Mark all multiples of p as not prime
            for i in range(p * p, n + 1, p):
                is_prime[i] = False
        p += 1
        
    primes = [p for p in range(2, n + 1) if is_prime[p]]
    return primes

# --- Task 25: GCD and LCM (Euclidean Algorithm) ---
def gcd(a: int, b: int) -> int:
    a, b = abs(a), abs(b)
    while b:
        a, b = b, a % b
    return a

def lcm(a: int, b: int) -> int:
    if a == 0 or b == 0:
        return 0
    # lcm(a, b) = |a * b| / gcd(a, b)
    return abs(a * b) // gcd(a, b)


# --- Task 26: Matrix Multiplication ---
def mat_mul(a: list[list[int]], b: list[list[int]]) -> list[list[int]]:
    rows_a = len(a)
    cols_a = len(a[0]) if rows_a > 0 else 0
    rows_b = len(b)
    cols_b = len(b[0]) if rows_b > 0 else 0

    if cols_a != rows_b:
        raise ValueError("Matrix dimensions are incompatible for multiplication")

    result = [[0] * cols_b for _ in range(rows_a)]

    for i in range(rows_a):
        for j in range(cols_b):
            sum_val = 0
            for k in range(cols_a):
                sum_val += a[i][k] * b[k][j]
            result[i][j] = sum_val
            
    return result

# --- Task 27: Conway's Game of Life (One Step) ---
def life_step(grid: list[list[int]]) -> list[list[int]]:
    R = len(grid)
    C = len(grid[0])
    new_grid = [[0] * C for _ in range(R)]

    for r in range(R):
        for c in range(C):
            live_neighbors = 0
            # Check 8 neighbors
            for dr in [-1, 0, 1]:
                for dc in [-1, 0, 1]:
                    if dr == 0 and dc == 0:
                        continue
                    
                    nr, nc = r + dr, c + dc
                    
                    # Boundary check (out-of-bounds is dead)
                    if 0 <= nr < R and 0 <= nc < C:
                        live_neighbors += grid[nr][nc]

            # Apply Game of Life rules
            if grid[r][c] == 1:
                # Live cell survival
                if live_neighbors == 2 or live_neighbors == 3:
                    new_grid[r][c] = 1
                else:
                    new_grid[r][c] = 0
            else:
                # Dead cell birth
                if live_neighbors == 3:
                    new_grid[r][c] = 1
                else:
                    new_grid[r][c] = 0

    return new_grid

# --- Task 28: Flood Fill (BFS based) ---
def flood_fill(grid: list[list[int]], row: int, col: int, new_color: int) -> list[list[int]]:
    if not grid or row < 0 or row >= len(grid) or col < 0 or col >= len(grid[0]):
        return grid

    R = len(grid)
    C = len(grid[0])
    start_color = grid[row][col]

    if start_color == new_color:
        return [row[:] for row in grid] # Return a copy unchanged

    # BFS to find all connected cells of the same color
    queue = deque([(row, col)])
    new_grid_list = [r[:] for r in grid] # Create a mutable copy

    while queue:
        r, c = queue.popleft()

        if new_grid_list[r][c] != start_color:
            continue
            
        new_grid_list[r][c] = new_color

        # Check 4-directional neighbors
        for dr, dc in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
            nr, nc = r + dr, c + dc
            
            if 0 <= nr < R and 0 <= nc < C:
                # Only add to queue if it has the original color AND hasn't been processed/queued yet (implicitly handled by checking against start_color)
                if new_grid_list[nr][nc] == start_color:
                    queue.append((nr, nc))

    return new_grid_list