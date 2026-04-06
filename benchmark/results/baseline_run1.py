from collections import deque, defaultdict
from typing import Any, Optional

# ==============================================================================
# Category 1: Basic Data Structures
# ==============================================================================

class MinStack:
    def __init__(self):
        self.stack: list[int] = []
        self.min_stack: list[int] = []

    def push(self, val: int) -> None:
        self.stack.append(val)
        if not self.min_stack or val <= self.min_stack[-1]:
            self.min_stack.append(val)
        else:
            self.min_stack.append(self.min_stack[-1])

    def pop(self) -> None:
        if not self.stack:
            return
        popped_val = self.stack.pop()
        if popped_val == self.min_stack[-1]:
            self.min_stack.pop()
        else:
            self.min_stack.pop()

    def top(self) -> int:
        if not self.stack:
            raise IndexError("top() called on an empty stack")
        return self.stack[-1]

    def get_min(self) -> int:
        if not self.min_stack:
            raise IndexError("get_min() called on an empty stack")
        return self.min_stack[-1]

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
        
    def pop(self) -> int:
        self._transfer()
        if not self.stack2:
            raise IndexError("pop() called on an empty queue")
        return self.stack2.pop()

    def peek(self) -> int:
        self._transfer()
        if not self.stack2:
            raise IndexError("peek() called on an empty queue")
        return self.stack2[-1]

    def empty(self) -> bool:
        return not self.stack1 and not self.stack2

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
                else:
                    current.prev.next = current.next
                
                if current == self.tail:
                    self.tail = current.prev
                
                # If the deleted node was the head, we are done. Otherwise, we need to find the new head if it existed.
                if current == self.head:
                    pass # Head updated above
                else:
                    # If we delete an internal node, the head remains the same unless it was the only node.
                    pass

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

class HashMap:
    def __init__(self, initial_capacity: int = 16):
        self.capacity = initial_capacity
        # Store (key, value, state). State can be 'occupied', 'deleted' (tombstone), or 'empty'.
        self.table: list[tuple[str, Any, str]] = [("", None, "empty")] * self.capacity
        self.size = 0
        self.deleted_count = 0

    def _hash(self, key: str) -> int:
        # Simple polynomial rolling hash for string keys
        hash_val = 0
        for char in key:
            hash_val = (hash_val * 31 + ord(char)) % self.capacity
        return hash_val

    def _resize(self):
        old_table = self.table
        self.capacity *= 2
        self.table = [("", None, "empty")] * self.capacity
        self.size = 0
        self.deleted_count = 0

        for _, value, state in old_table:
            if state == "occupied":
                # Re-insert into the new table using the current capacity and hash function
                self.put(value[0], value[1], False) # Use internal put without resizing check
            elif state == "deleted":
                self.deleted_count += 1

    def put(self, key: str, value: Any, replace: bool = False) -> None:
        if self.size / self.capacity > 0.75:
            self._resize()

        hash_val = self._hash(key)
        start_index = hash_val
        
        # Linear probing
        for i in range(self.capacity):
            index = (start_index + i) % self.capacity
            k, v, state = self.table[index]

            if state == "empty" or state == "deleted":
                # Found an empty or tombstone slot. Insert here if it's a new insertion or overwrite.
                if state == "deleted":
                    self.deleted_count -= 1 # Reclaim the tombstone count
                
                self.table[index] = (key, value, "occupied")
                self.size += 1
                if replace:
                    self.deleted_count += 1 # Mark the old entry as deleted if it was a replacement
                return

            if k == key:
                # Key found
                if state == "occupied":
                    if replace:
                        # Overwrite operation: mark old slot as deleted (tombstone)
                        self.table[index] = (key, None, "deleted")
                        self.deleted_count += 1
                    else:
                        # Simple overwrite
                        self.table[index] = (key, value, "occupied")
                return

            # Collision, continue probing
        
        # Should not be reached if resizing is handled correctly and capacity is large enough
        raise Exception("HashMap insertion failed")


    def get(self, key: str) -> Any:
        hash_val = self._hash(key)
        start_index = hash_val

        for i in range(self.capacity):
            index = (start_index + i) % self.capacity
            k, v, state = self.table[index]

            if state == "empty":
                return None  # Key definitely not present
            
            if state == "occupied" and k == key:
                return v  # Found the value
        
        return None # Not found after full probe

    def remove(self, key: str) -> None:
        hash_val = self._hash(key)
        start_index = hash_val

        for i in range(self.capacity):
            index = (start_index + i) % self.capacity
            k, v, state = self.table[index]

            if state == "empty":
                return  # Key not present
            
            if state == "occupied" and k == key:
                # Mark as deleted (tombstone)
                self.table[index] = (key, None, "deleted")
                self.size -= 1
                self.deleted_count += 1
                return

        # Key not found after full probe
        pass


class PriorityQueue:
    def __init__(self):
        self.heap: list[int] = []

    def _swap(self, i: int, j: int) -> None:
        self.heap[i], self.heap[j] = self.heap[j], self.heap[i]

    def _sift_up(self, index: int) -> None:
        while index > 0:
            parent_index = (index - 1) // 2
            if self.heap[index] < self.heap[parent_index]:
                self._swap(index, parent_index)
                index = parent_index
            else:
                break

    def _sift_down(self, index: int) -> None:
        n = len(self.heap)
        while True:
            left_child = 2 * index + 1
            right_child = 2 * index + 2
            smallest = index

            if left_child < n and self.heap[left_child] < self.heap[smallest]:
                smallest = left_child
            if right_child < n and self.heap[right_child] < self.heap[smallest]:
                smallest = right_child

            if smallest != index:
                self._swap(index, smallest)
                index = smallest
            else:
                break

    def push(self, val: int) -> None:
        self.heap.append(val)
        self._sift_up(len(self.heap) - 1)

    def pop(self) -> int:
        if not self.heap:
            raise IndexError("pop() called on an empty priority queue")
        
        min_val = self.heap[0]
        last_val = self.heap.pop()
        if self.heap:
            self.heap[0] = last_val
            self._sift_down(0)
        return min_val

    def peek(self) -> int:
        if not self.heap:
            raise IndexError("peek() called on an empty priority queue")
        return self.heap[0]

    def size(self) -> int:
        return len(self.heap)

# ==============================================================================
# Category 2: String Manipulation
# ==============================================================================

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
        
        if not count_str:
            # Should not happen with valid encoding, but for safety
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

def longest_palindrome(s: str) -> str:
    n = len(s)
    if n == 0:
        return ""
    
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

# ==============================================================================
# Category 3: Sorting & Searching
# ==============================================================================

def merge_sort(arr: list[int]) -> list[int]:
    if len(arr) <= 1:
        return arr
    
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

def search_range(arr: list[int], target: int) -> tuple[int, int]:
    if not arr:
        return (-1, -1)
    
    low = 0
    high = len(arr) - 1
    first_index, last_index = -1, -1

    while low <= high:
        mid = (low + high) // 2
        if arr[mid] == target:
            first_index = min(first_index, mid)
            last_index = max(last_index, mid)
            low = mid + 1  # Search for the first occurrence
        elif arr[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    
    if first_index != -1:
        return (first_index, last_index)
    else:
        return (-1, -1)

def kth_largest(arr: list[int], k: int) -> int:
    # Use sorting for simplicity and correctness, as no external libraries are allowed.
    if not arr or k <= 0 or k > len(arr):
        raise ValueError("Invalid input for kth_largest")
        
    # Sort in descending order to find the k-th largest element (index k-1)
    sorted_arr = sorted(arr, reverse=True)
    return sorted_arr[k - 1]

# ==============================================================================
# Category 4: Dynamic Programming
# ==============================================================================

def fib(n: int) -> int:
    if n == 0: return 0
    if n == 1: return 1
    
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b

def coin_change(coins: list[int], amount: int) -> int:
    # Dynamic Programming approach
    if amount == 0:
        return 0
    
    # dp[i] will store the minimum number of coins to make amount i
    dp = [float('inf')] * (amount + 1)
    dp[0] = 0
    
    for i in range(1, amount + 1):
        for coin in coins:
            if i >= coin:
                if dp[i - coin] != float('inf'):
                    dp[i] = min(dp[i], dp[i - coin] + 1)
    
    return dp[amount] if dp[amount] != float('inf') else -1

def lcs(s1: str, s2: str) -> str:
    m = len(s1)
    n = len(s2)
    
    # dp[i][j] stores the LCS of s1[:i] and s2[:j]
    dp = [["" for _ in range(n + 1)] for _ in range(m + 1)]

    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if s1[i - 1] == s2[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + s1[i - 1]
            else:
                # Choose the longer subsequence
                if len(dp[i - 1][j]) >= len(dp[i][j - 1]):
                    dp[i][j] = dp[i - 1][j]
                else:
                    dp[i][j] = dp[i][j - 1]

    return dp[m][n]

def edit_distance(s1: str, s2: str) -> int:
    m = len(s1)
    n = len(s2)
    
    # dp[i][j] is the edit distance between s1[:i] and s2[:j]
    dp = [[0] * (n + 1) for _ in range(m + 1)]

    # Initialize first row and column
    for i in range(m + 1):
        dp[i][0] = i  # Deletions to transform s1[:i] to ""
    for j in range(n + 1):
        dp[0][j] = j  # Insertions to transform "" to s2[:j]

    # Fill the DP table
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            cost = 0 if s1[i - 1] == s2[j - 1] else 1
            
            dp[i][j] = min(
                dp[i - 1][j] + 1,          # Deletion from s1 (or insertion into s2)
                dp[i][j - 1] + 1,          # Insertion into s1 (or deletion from s2)
                dp[i - 1][j - 1] + cost    # Match or Replace
            )

    return dp[m][n]

def knapsack(weights: list[int], values: list[int], capacity: int) -> int:
    n = len(weights)
    if n == 0 or capacity == 0:
        return 0
    
    # DP table: dp[w] is the max value for weight w
    dp = [0] * (capacity + 1)
    
    for i in range(n):
        w, v = weights[i], values[i]
        # Iterate backwards to ensure each item is considered at most once (0/1 Knapsack)
        for w_cap in range(capacity, w - 1, -1):
            dp[w_cap] = max(dp[w_cap], dp[w_cap - w] + v)
            
    return dp[capacity]

# ==============================================================================
# Category 5: Graph Algorithms
# ==============================================================================

def bfs_shortest(graph: dict, start, end) -> list:
    if start == end:
        return [start]
    
    queue = deque([start])
    visited = {start}
    parent = {node: None for node in graph}
    
    while queue:
        u = queue.popleft()
        
        for v in graph.get(u, []):
            if v not in visited:
                visited.add(v)
                parent[v] = u
                if v == end:
                    # Path found, reconstruct it
                    path = [end]
                    curr = end
                    while curr != start:
                        curr = parent[curr]
                        path.append(curr)
                    return path[::-1]
                queue.append(v)

    return [] # No path exists

def has_cycle(graph: dict) -> bool:
    visited = set()
    recursion_stack = set()

    def dfs(node):
        visited.add(node)
        recursion_stack.add(node)

        for neighbor in graph.get(node, []):
            if neighbor not in visited:
                if dfs(neighbor):
                    return True
            elif neighbor in recursion_stack:
                return True  # Cycle detected
        
        recursion_stack.remove(node)
        return False

    for node in graph:
        if node not in visited:
            if dfs(node):
                return True
    
    return False

def topo_sort(graph: dict) -> list:
    in_degree = defaultdict(int)
    
    # Initialize in-degrees for all nodes, including those with no outgoing edges
    all_nodes = set(graph.keys())
    for u in graph:
        for v in graph[u]:
            all_nodes.add(v)

    for node in all_nodes:
        in_degree[node] = 0

    # Calculate in-degrees
    for u in graph:
        for v in graph[u]:
            in_degree[v] += 1

    queue = deque([node for node in all_nodes if in_degree[node] == 0])
    topological_order = []
    
    while queue:
        u = queue.popleft()
        topological_order.append(u)
        
        for v in graph.get(u, []):
            in_degree[v] -= 1
            if in_degree[v] == 0:
                queue.append(v)

    # Check for cycle
    if len(topological_order) != len(all_nodes):
        return []  # Cycle detected
    
    return topological_order

def primes_up_to(n: int) -> list[int]:
    if n < 2:
        return []
    
    is_prime = [True] * (n + 1)
    is_prime[0] = is_prime[1] = False
    
    for p in range(2, int(n**0.5) + 1):
        if is_prime[p]:
            for i in range(p * p, n + 1, p):
                is_prime[i] = False
                
    primes = [p for p in range(2, n + 1) if is_prime[p]]
    return primes

def gcd(a: int, b: int) -> int:
    # Euclidean algorithm
    a, b = abs(a), abs(b)
    while b:
        a, b = b, a % b
    return a

def lcm(a: int, b: int) -> int:
    if a == 0 or b == 0:
        return 0
    # lcm(a, b) = |a * b| / gcd(a, b)
    return abs(a * b) // gcd(a, b)

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

            current_state = grid[r][c]
            
            if current_state == 1:
                # Live cell rules
                if live_neighbors == 2 or live_neighbors == 3:
                    new_grid[r][c] = 1  # Survives
                else:
                    new_grid[r][c] = 0  # Dies
            else:
                # Dead cell rules
                if live_neighbors == 3:
                    new_grid[r][c] = 1  # Becomes alive
                else:
                    new_grid[r][c] = 0  # Stays dead

    return new_grid

def flood_fill(grid: list[list[int]], row: int, col: int, new_color: int) -> list[list[int]]:
    R = len(grid)
    C = len(grid[0])
    
    if not (0 <= row < R and 0 <= col < C):
        return grid

    if grid[row][col] == new_color:
        return [row[:] for row in grid] # Return a copy if no change is needed

    # Use BFS to find connected region of the same color
    start_color = grid[row][col]
    queue = deque([(row, col)])
    new_grid = [row[:] for row in grid]

    while queue:
        r, c = queue.popleft()
        new_grid[r][c] = new_color

        # 4-directional neighbors
        for dr, dc in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
            nr, nc = r + dr, c + dc
            
            if 0 <= nr < R and 0 <= nc < C:
                # Only fill cells that share the original color
                if grid[nr][nc] == start_color:
                    queue.append((nr, nc))

    return new_grid