#!/usr/bin/env python3
"""Automated evaluator for Gemma Benchmark v3: 50 Programming Tasks."""

import sys
import importlib.util
import time
import traceback


def load_solution(path):
    spec = importlib.util.spec_from_file_location("solution", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# ============================================================
# Category 1: Basic Data Structures
# ============================================================

def test_min_stack(sol):
    results = []

    # Test 1: Basic push/pop/min
    s = sol.MinStack()
    s.push(3); s.push(1); s.push(2)
    results.append(("minstack basic", s.get_min() == 1 and s.top() == 2, s.get_min(), 1))

    # Test 2: Min updates after pop
    s.pop()  # remove 2
    results.append(("minstack pop updates min", s.get_min() == 1, s.get_min(), 1))
    s.pop()  # remove 1
    results.append(("minstack min after pop", s.get_min() == 3, s.get_min(), 3))

    # Test 3: Duplicate mins
    s2 = sol.MinStack()
    s2.push(1); s2.push(1); s2.push(2)
    s2.pop(); s2.pop()
    results.append(("minstack dup mins", s2.get_min() == 1, s2.get_min(), 1))

    # Test 4: Single element
    s3 = sol.MinStack()
    s3.push(42)
    results.append(("minstack single", s3.top() == 42 and s3.get_min() == 42, s3.top(), 42))

    return results


def test_queue_from_stacks(sol):
    results = []

    q = sol.MyQueue()
    q.push(1); q.push(2); q.push(3)
    results.append(("queue peek", q.peek() == 1, q.peek(), 1))
    results.append(("queue pop", q.pop() == 1, q.pop(), 1))
    # After popping 1, next should be 2 (but we already popped via the test above)
    # Re-create for clean test
    q2 = sol.MyQueue()
    q2.push(10); q2.push(20)
    r1 = q2.pop()
    r2 = q2.pop()
    results.append(("queue fifo order", r1 == 10 and r2 == 20, (r1, r2), (10, 20)))
    results.append(("queue empty", q2.empty() == True, q2.empty(), True))

    q3 = sol.MyQueue()
    q3.push(1)
    q3.pop()
    q3.push(2)
    results.append(("queue interleaved", q3.peek() == 2, q3.peek(), 2))

    return results


def test_doubly_linked_list(sol):
    results = []

    dll = sol.DoublyLinkedList()
    dll.insert_front(1)
    dll.insert_back(2)
    dll.insert_front(0)
    results.append(("dll order", dll.to_list() == [0, 1, 2], dll.to_list(), [0, 1, 2]))

    dll.delete(1)
    results.append(("dll delete middle", dll.to_list() == [0, 2], dll.to_list(), [0, 2]))

    results.append(("dll find exists", dll.find(2) == True, dll.find(2), True))
    results.append(("dll find missing", dll.find(99) == False, dll.find(99), False))

    dll.delete(0)
    dll.delete(2)
    results.append(("dll empty", dll.to_list() == [], dll.to_list(), []))

    dll2 = sol.DoublyLinkedList()
    dll2.insert_back(5)
    dll2.insert_front(3)
    dll2.insert_back(7)
    results.append(("dll mixed insert", dll2.to_list() == [3, 5, 7], dll2.to_list(), [3, 5, 7]))

    return results


def test_hash_map(sol):
    results = []

    hm = sol.HashMap()
    hm.put("a", 1)
    hm.put("b", 2)
    results.append(("hashmap get", hm.get("a") == 1, hm.get("a"), 1))
    results.append(("hashmap missing", hm.get("z") is None, hm.get("z"), None))

    hm.put("a", 99)
    results.append(("hashmap overwrite", hm.get("a") == 99, hm.get("a"), 99))

    hm.remove("a")
    results.append(("hashmap remove", hm.get("a") is None, hm.get("a"), None))

    # Test resize: insert enough items to trigger
    hm2 = sol.HashMap()
    for i in range(20):
        hm2.put(f"key{i}", i)
    results.append(("hashmap bulk", hm2.get("key15") == 15, hm2.get("key15"), 15))

    results.append(("hashmap remove missing", hm2.remove("nonexistent") is None, True, True))

    return results


def test_priority_queue(sol):
    results = []

    pq = sol.PriorityQueue()
    pq.push(3); pq.push(1); pq.push(2)
    results.append(("pq peek min", pq.peek() == 1, pq.peek(), 1))
    results.append(("pq pop min", pq.pop() == 1, pq.pop(), 1))

    pq2 = sol.PriorityQueue()
    pq2.push(5); pq2.push(3); pq2.push(7); pq2.push(1)
    order = [pq2.pop() for _ in range(4)]
    results.append(("pq sorted order", order == [1, 3, 5, 7], order, [1, 3, 5, 7]))

    results.append(("pq size", pq2.size() == 0, pq2.size(), 0))

    pq3 = sol.PriorityQueue()
    pq3.push(2); pq3.push(2); pq3.push(1)
    results.append(("pq duplicates", pq3.pop() == 1, pq3.pop(), 1))
    results.append(("pq dup remaining", pq3.pop() == 2, pq3.pop(), 2))

    return results


# ============================================================
# Category 2: String Manipulation
# ============================================================

def test_rle(sol):
    results = []
    results.append(("rle encode basic", sol.rle_encode("aaabbc") == "3a2b1c", sol.rle_encode("aaabbc"), "3a2b1c"))
    results.append(("rle encode single", sol.rle_encode("abc") == "1a1b1c", sol.rle_encode("abc"), "1a1b1c"))
    results.append(("rle decode basic", sol.rle_decode("3a2b1c") == "aaabbc", sol.rle_decode("3a2b1c"), "aaabbc"))
    results.append(("rle roundtrip", sol.rle_decode(sol.rle_encode("hello")) == "hello", True, True))
    results.append(("rle empty", sol.rle_encode("") == "", sol.rle_encode(""), ""))
    return results


def test_balanced_brackets(sol):
    results = []
    results.append(("brackets valid", sol.is_balanced("()[]{}") == True, sol.is_balanced("()[]{}"), True))
    results.append(("brackets nested", sol.is_balanced("{[()]}") == True, sol.is_balanced("{[()]}"), True))
    results.append(("brackets invalid", sol.is_balanced("([)]") == False, sol.is_balanced("([)]"), False))
    results.append(("brackets empty", sol.is_balanced("") == True, sol.is_balanced(""), True))
    results.append(("brackets single open", sol.is_balanced("(") == False, sol.is_balanced("("), False))
    results.append(("brackets with text", sol.is_balanced("a(b[c]d)e") == True, sol.is_balanced("a(b[c]d)e"), True))
    return results


def test_longest_palindrome(sol):
    results = []
    r1 = sol.longest_palindrome("babad")
    results.append(("palindrome basic", r1 in ("bab", "aba"), r1, "bab or aba"))
    results.append(("palindrome full", sol.longest_palindrome("racecar") == "racecar", sol.longest_palindrome("racecar"), "racecar"))
    results.append(("palindrome single", sol.longest_palindrome("a") == "a", sol.longest_palindrome("a"), "a"))
    results.append(("palindrome none", len(sol.longest_palindrome("abcd")) == 1, len(sol.longest_palindrome("abcd")), 1))
    results.append(("palindrome even", sol.longest_palindrome("abba") == "abba", sol.longest_palindrome("abba"), "abba"))
    results.append(("palindrome empty", sol.longest_palindrome("") == "", sol.longest_palindrome(""), ""))
    return results


def test_regex_match(sol):
    results = []
    results.append(("regex exact", sol.regex_match("abc", "abc") == True, True, True))
    results.append(("regex dot", sol.regex_match("abc", "a.c") == True, True, True))
    results.append(("regex star", sol.regex_match("aab", "a*b") == True, True, True))
    results.append(("regex dot star", sol.regex_match("abc", ".*") == True, True, True))
    results.append(("regex no match", sol.regex_match("abc", "abd") == False, False, False))
    results.append(("regex star zero", sol.regex_match("b", "a*b") == True, True, True))
    results.append(("regex complex", sol.regex_match("aab", "c*a*b") == True, True, True))
    results.append(("regex empty pattern", sol.regex_match("", "a*") == True, True, True))
    return results


def test_string_calc(sol):
    results = []
    results.append(("calc basic", sol.calc("2+3") == 5.0, sol.calc("2+3"), 5.0))
    results.append(("calc precedence", sol.calc("2+3*4") == 14.0, sol.calc("2+3*4"), 14.0))
    results.append(("calc parens", sol.calc("(2+3)*4") == 20.0, sol.calc("(2+3)*4"), 20.0))
    results.append(("calc division", sol.calc("10/4") == 2.5, sol.calc("10/4"), 2.5))
    results.append(("calc negative", sol.calc("-3+5") == 2.0, sol.calc("-3+5"), 2.0))
    results.append(("calc nested parens", sol.calc("((2+3))") == 5.0, sol.calc("((2+3))"), 5.0))
    results.append(("calc complex", sol.calc("2*(3+4)-1") == 13.0, sol.calc("2*(3+4)-1"), 13.0))
    results.append(("calc spaces", sol.calc("  2 + 3  ") == 5.0, sol.calc("  2 + 3  "), 5.0))
    return results


# ============================================================
# Category 3: Sorting & Searching
# ============================================================

def test_merge_sort(sol):
    results = []
    results.append(("msort basic", sol.merge_sort([3,1,2]) == [1,2,3], sol.merge_sort([3,1,2]), [1,2,3]))
    results.append(("msort empty", sol.merge_sort([]) == [], sol.merge_sort([]), []))
    results.append(("msort single", sol.merge_sort([1]) == [1], sol.merge_sort([1]), [1]))
    results.append(("msort sorted", sol.merge_sort([1,2,3]) == [1,2,3], sol.merge_sort([1,2,3]), [1,2,3]))
    results.append(("msort duplicates", sol.merge_sort([3,1,2,1]) == [1,1,2,3], sol.merge_sort([3,1,2,1]), [1,1,2,3]))
    return results


def test_search_range(sol):
    results = []
    results.append(("srange found", sol.search_range([1,2,3,3,3,4], 3) == (2, 4), sol.search_range([1,2,3,3,3,4], 3), (2, 4)))
    results.append(("srange single", sol.search_range([1,2,3,4], 3) == (2, 2), sol.search_range([1,2,3,4], 3), (2, 2)))
    results.append(("srange not found", sol.search_range([1,2,4,5], 3) == (-1, -1), sol.search_range([1,2,4,5], 3), (-1, -1)))
    results.append(("srange empty", sol.search_range([], 1) == (-1, -1), sol.search_range([], 1), (-1, -1)))
    results.append(("srange all same", sol.search_range([2,2,2], 2) == (0, 2), sol.search_range([2,2,2], 2), (0, 2)))
    results.append(("srange edges", sol.search_range([1,1,3,3], 1) == (0, 1), sol.search_range([1,1,3,3], 1), (0, 1)))
    return results


def test_kth_largest(sol):
    results = []
    results.append(("kth basic", sol.kth_largest([3,2,1,5,6,4], 2) == 5, sol.kth_largest([3,2,1,5,6,4], 2), 5))
    results.append(("kth first", sol.kth_largest([3,2,1], 1) == 3, sol.kth_largest([3,2,1], 1), 3))
    results.append(("kth last", sol.kth_largest([3,2,1], 3) == 1, sol.kth_largest([3,2,1], 3), 1))
    results.append(("kth dups", sol.kth_largest([3,2,3,1,2,4,5,5,6], 4) == 4, sol.kth_largest([3,2,3,1,2,4,5,5,6], 4), 4))
    results.append(("kth single", sol.kth_largest([1], 1) == 1, sol.kth_largest([1], 1), 1))
    results.append(("kth negative", sol.kth_largest([-1,-2,-3], 1) == -1, sol.kth_largest([-1,-2,-3], 1), -1))
    return results


def test_merge_k_sorted(sol):
    results = []
    results.append(("mergek basic", sol.merge_k_sorted([[1,4,5],[1,3,4],[2,6]]) == [1,1,2,3,4,4,5,6], sol.merge_k_sorted([[1,4,5],[1,3,4],[2,6]]), [1,1,2,3,4,4,5,6]))
    results.append(("mergek empty lists", sol.merge_k_sorted([[], []]) == [], sol.merge_k_sorted([[], []]), []))
    results.append(("mergek single", sol.merge_k_sorted([[1]]) == [1], sol.merge_k_sorted([[1]]), [1]))
    results.append(("mergek one list", sol.merge_k_sorted([[1,2,3]]) == [1,2,3], sol.merge_k_sorted([[1,2,3]]), [1,2,3]))
    results.append(("mergek empty input", sol.merge_k_sorted([]) == [], sol.merge_k_sorted([]), []))
    results.append(("mergek negatives", sol.merge_k_sorted([[-3,-1],[- 2,0]]) == [-3,-2,-1,0], sol.merge_k_sorted([[-3,-1],[-2,0]]), [-3,-2,-1,0]))
    return results


def test_count_inversions(sol):
    results = []
    results.append(("inv basic", sol.count_inversions([2,4,1,3,5]) == 3, sol.count_inversions([2,4,1,3,5]), 3))
    results.append(("inv sorted", sol.count_inversions([1,2,3]) == 0, sol.count_inversions([1,2,3]), 0))
    results.append(("inv reversed", sol.count_inversions([3,2,1]) == 3, sol.count_inversions([3,2,1]), 3))
    results.append(("inv single", sol.count_inversions([1]) == 0, sol.count_inversions([1]), 0))
    results.append(("inv empty", sol.count_inversions([]) == 0, sol.count_inversions([]), 0))
    results.append(("inv large", sol.count_inversions([5,4,3,2,1]) == 10, sol.count_inversions([5,4,3,2,1]), 10))
    return results


# ============================================================
# Categories 4-10: Stubs (to be filled in subsequent tasks)
# ============================================================

def test_fib(sol):
    results = []
    results.append(("fib 0", sol.fib(0) == 0, sol.fib(0), 0))
    results.append(("fib 1", sol.fib(1) == 1, sol.fib(1), 1))
    results.append(("fib 10", sol.fib(10) == 55, sol.fib(10), 55))
    results.append(("fib 20", sol.fib(20) == 6765, sol.fib(20), 6765))
    results.append(("fib 50", sol.fib(50) == 12586269025, sol.fib(50), 12586269025))
    return results


def test_coin_change(sol):
    results = []
    results.append(("coin basic", sol.coin_change([1,5,10], 11) == 2, sol.coin_change([1,5,10], 11), 2))
    results.append(("coin impossible", sol.coin_change([2], 3) == -1, sol.coin_change([2], 3), -1))
    results.append(("coin zero", sol.coin_change([1], 0) == 0, sol.coin_change([1], 0), 0))
    results.append(("coin exact", sol.coin_change([1,5,10,25], 30) == 2, sol.coin_change([1,5,10,25], 30), 2))
    results.append(("coin single", sol.coin_change([3], 9) == 3, sol.coin_change([3], 9), 3))
    results.append(("coin large", sol.coin_change([1,5,10,25], 100) == 4, sol.coin_change([1,5,10,25], 100), 4))
    return results


def test_lcs(sol):
    results = []
    results.append(("lcs basic", sol.lcs("abcde", "ace") == "ace", sol.lcs("abcde", "ace"), "ace"))
    results.append(("lcs empty", sol.lcs("", "abc") == "", sol.lcs("", "abc"), ""))
    results.append(("lcs same", sol.lcs("abc", "abc") == "abc", sol.lcs("abc", "abc"), "abc"))
    results.append(("lcs none", sol.lcs("abc", "xyz") == "", sol.lcs("abc", "xyz"), ""))
    r = sol.lcs("AGGTAB", "GXTXAYB")
    results.append(("lcs medium", len(r) == 4, len(r), 4))
    results.append(("lcs single", sol.lcs("a", "a") == "a", sol.lcs("a", "a"), "a"))
    return results


def test_edit_distance(sol):
    results = []
    results.append(("edit basic", sol.edit_distance("kitten", "sitting") == 3, sol.edit_distance("kitten", "sitting"), 3))
    results.append(("edit same", sol.edit_distance("abc", "abc") == 0, sol.edit_distance("abc", "abc"), 0))
    results.append(("edit empty", sol.edit_distance("", "abc") == 3, sol.edit_distance("", "abc"), 3))
    results.append(("edit both empty", sol.edit_distance("", "") == 0, sol.edit_distance("", ""), 0))
    results.append(("edit single", sol.edit_distance("a", "b") == 1, sol.edit_distance("a", "b"), 1))
    results.append(("edit delete", sol.edit_distance("abc", "ab") == 1, sol.edit_distance("abc", "ab"), 1))
    return results


def test_knapsack(sol):
    results = []
    results.append(("knapsack basic", sol.knapsack([1,2,3], [6,10,12], 5) == 22, sol.knapsack([1,2,3], [6,10,12], 5), 22))
    results.append(("knapsack zero cap", sol.knapsack([1,2], [3,4], 0) == 0, sol.knapsack([1,2], [3,4], 0), 0))
    results.append(("knapsack single", sol.knapsack([5], [10], 5) == 10, sol.knapsack([5], [10], 5), 10))
    results.append(("knapsack no fit", sol.knapsack([5,6], [10,12], 4) == 0, sol.knapsack([5,6], [10,12], 4), 0))
    results.append(("knapsack all fit", sol.knapsack([1,1,1], [5,5,5], 10) == 15, sol.knapsack([1,1,1], [5,5,5], 10), 15))
    results.append(("knapsack medium", sol.knapsack([2,3,4,5], [3,4,5,6], 8) == 11, sol.knapsack([2,3,4,5], [3,4,5,6], 8), 11))
    return results


# ============================================================
# Additional categories (25-50) — simplified tests
# ============================================================

def test_bfs_shortest(sol):
    results = []
    g = {'A': ['B','C'], 'B': ['D'], 'C': ['D'], 'D': []}
    results.append(("bfs basic", sol.bfs_shortest(g, 'A', 'D') in (['A','B','D'], ['A','C','D']), sol.bfs_shortest(g, 'A', 'D'), "['A','B','D'] or ['A','C','D']"))
    results.append(("bfs same", sol.bfs_shortest(g, 'A', 'A') == ['A'], sol.bfs_shortest(g, 'A', 'A'), ['A']))
    g2 = {'A': ['B'], 'B': [], 'C': []}
    results.append(("bfs no path", sol.bfs_shortest(g2, 'A', 'C') == [], sol.bfs_shortest(g2, 'A', 'C'), []))
    g3 = {'A': ['B'], 'B': ['C'], 'C': ['D'], 'D': []}
    results.append(("bfs linear", sol.bfs_shortest(g3, 'A', 'D') == ['A','B','C','D'], sol.bfs_shortest(g3, 'A', 'D'), ['A','B','C','D']))
    results.append(("bfs direct", sol.bfs_shortest({'A': ['B'], 'B': []}, 'A', 'B') == ['A','B'], True, True))
    return results


def test_has_cycle(sol):
    results = []
    results.append(("cycle yes", sol.has_cycle({'A': ['B'], 'B': ['C'], 'C': ['A']}) == True, True, True))
    results.append(("cycle no", sol.has_cycle({'A': ['B'], 'B': ['C'], 'C': []}) == False, False, False))
    results.append(("cycle self", sol.has_cycle({'A': ['A']}) == True, True, True))
    results.append(("cycle empty", sol.has_cycle({}) == False, False, False))
    results.append(("cycle diamond", sol.has_cycle({'A': ['B','C'], 'B': ['D'], 'C': ['D'], 'D': []}) == False, False, False))
    results.append(("cycle complex", sol.has_cycle({'A': ['B'], 'B': ['C','D'], 'C': [], 'D': ['A']}) == True, True, True))
    return results


def test_topo_sort(sol):
    results = []
    g = {'A': ['C'], 'B': ['C','D'], 'C': ['E'], 'D': ['E'], 'E': []}
    r = sol.topo_sort(g)
    # Verify it's a valid topological order
    pos = {v: i for i, v in enumerate(r)}
    valid = all(pos[u] < pos[v] for u in g for v in g[u])
    results.append(("topo valid", valid, r, "valid topological order"))
    results.append(("topo length", len(r) == 5, len(r), 5))
    results.append(("topo simple", sol.topo_sort({'A': ['B'], 'B': []}) == ['A', 'B'], sol.topo_sort({'A': ['B'], 'B': []}), ['A', 'B']))
    results.append(("topo single", sol.topo_sort({'A': []}) == ['A'], sol.topo_sort({'A': []}), ['A']))
    results.append(("topo empty", sol.topo_sort({}) == [], sol.topo_sort({}), []))
    r2 = sol.topo_sort({'A': ['B','C'], 'B': ['D'], 'C': ['D'], 'D': []})
    pos2 = {v: i for i, v in enumerate(r2)}
    results.append(("topo diamond", pos2['A'] < pos2['D'] and pos2['B'] < pos2['D'], True, True))
    return results


def test_primes(sol):
    results = []
    results.append(("primes 10", sol.primes_up_to(10) == [2,3,5,7], sol.primes_up_to(10), [2,3,5,7]))
    results.append(("primes 1", sol.primes_up_to(1) == [], sol.primes_up_to(1), []))
    results.append(("primes 2", sol.primes_up_to(2) == [2], sol.primes_up_to(2), [2]))
    results.append(("primes 30", sol.primes_up_to(30) == [2,3,5,7,11,13,17,19,23,29], sol.primes_up_to(30), [2,3,5,7,11,13,17,19,23,29]))
    results.append(("primes 0", sol.primes_up_to(0) == [], sol.primes_up_to(0), []))
    return results


def test_gcd_lcm(sol):
    results = []
    results.append(("gcd basic", sol.gcd(12, 8) == 4, sol.gcd(12, 8), 4))
    results.append(("gcd coprime", sol.gcd(7, 13) == 1, sol.gcd(7, 13), 1))
    results.append(("gcd same", sol.gcd(5, 5) == 5, sol.gcd(5, 5), 5))
    results.append(("lcm basic", sol.lcm(4, 6) == 12, sol.lcm(4, 6), 12))
    results.append(("lcm coprime", sol.lcm(3, 7) == 21, sol.lcm(3, 7), 21))
    return results


def test_mat_mul(sol):
    results = []
    a = [[1,2],[3,4]]
    b = [[5,6],[7,8]]
    results.append(("matmul 2x2", sol.mat_mul(a, b) == [[19,22],[43,50]], sol.mat_mul(a, b), [[19,22],[43,50]]))
    results.append(("matmul identity", sol.mat_mul([[1,0],[0,1]], [[5,6],[7,8]]) == [[5,6],[7,8]], True, True))
    a2 = [[1,2,3]]
    b2 = [[4],[5],[6]]
    results.append(("matmul 1x3 * 3x1", sol.mat_mul(a2, b2) == [[32]], sol.mat_mul(a2, b2), [[32]]))
    results.append(("matmul zeros", sol.mat_mul([[0,0],[0,0]], [[1,2],[3,4]]) == [[0,0],[0,0]], True, True))
    r = sol.mat_mul([[1,2],[3,4],[5,6]], [[7,8,9],[10,11,12]])
    results.append(("matmul 3x2 * 2x3", r == [[27,30,33],[61,68,75],[95,106,117]], r, [[27,30,33],[61,68,75],[95,106,117]]))
    results.append(("matmul single", sol.mat_mul([[3]], [[4]]) == [[12]], sol.mat_mul([[3]], [[4]]), [[12]]))
    return results


def test_flood_fill(sol):
    results = []
    g1 = [[1,1,1],[1,1,0],[1,0,1]]
    r1 = sol.flood_fill(g1, 1, 1, 2)
    results.append(("flood basic", r1 == [[2,2,2],[2,2,0],[2,0,1]], r1, [[2,2,2],[2,2,0],[2,0,1]]))
    g2 = [[0,0],[0,0]]
    r2 = sol.flood_fill(g2, 0, 0, 0)
    results.append(("flood same color", r2 == [[0,0],[0,0]], r2, [[0,0],[0,0]]))
    g3 = [[1]]
    results.append(("flood single", sol.flood_fill(g3, 0, 0, 5) == [[5]], sol.flood_fill([[1]], 0, 0, 5), [[5]]))
    g4 = [[1,0],[0,1]]
    results.append(("flood isolated", sol.flood_fill(g4, 0, 0, 2) == [[2,0],[0,1]], sol.flood_fill([[1,0],[0,1]], 0, 0, 2), [[2,0],[0,1]]))
    g5 = [[0,0,0],[0,1,0],[0,0,0]]
    results.append(("flood center", sol.flood_fill(g5, 1, 1, 3) == [[0,0,0],[0,3,0],[0,0,0]], sol.flood_fill([[0,0,0],[0,1,0],[0,0,0]], 1, 1, 3), [[0,0,0],[0,3,0],[0,0,0]]))
    return results


def test_life_step(sol):
    results = []
    g1 = [[0,1,0],[0,0,1],[1,1,1],[0,0,0]]
    r1 = sol.life_step(g1)
    results.append(("life glider", r1 == [[0,0,0],[1,0,1],[0,1,1],[0,1,0]], r1, [[0,0,0],[1,0,1],[0,1,1],[0,1,0]]))
    g2 = [[1,1],[1,1]]
    results.append(("life block stable", sol.life_step(g2) == [[1,1],[1,1]], sol.life_step(g2), [[1,1],[1,1]]))
    g3 = [[0,1,0],[0,1,0],[0,1,0]]
    r3 = sol.life_step(g3)
    results.append(("life blinker", r3 == [[0,0,0],[1,1,1],[0,0,0]], r3, [[0,0,0],[1,1,1],[0,0,0]]))
    g4 = [[0,0,0],[0,0,0],[0,0,0]]
    results.append(("life all dead", sol.life_step(g4) == [[0,0,0],[0,0,0],[0,0,0]], True, True))
    results.append(("life single alive", sol.life_step([[0,0,0],[0,1,0],[0,0,0]]) == [[0,0,0],[0,0,0],[0,0,0]], True, True))
    return results


def test_base_convert(sol):
    results = []
    results.append(("base dec to bin", sol.convert_base("10", 10, 2) == "1010", sol.convert_base("10", 10, 2), "1010"))
    results.append(("base bin to dec", sol.convert_base("1010", 2, 10) == "10", sol.convert_base("1010", 2, 10), "10"))
    results.append(("base hex to dec", sol.convert_base("FF", 16, 10) == "255", sol.convert_base("FF", 16, 10), "255"))
    results.append(("base dec to hex", sol.convert_base("255", 10, 16) == "FF", sol.convert_base("255", 10, 16), "FF"))
    results.append(("base zero", sol.convert_base("0", 10, 2) == "0", sol.convert_base("0", 10, 2), "0"))
    results.append(("base 36", sol.convert_base("Z", 36, 10) == "35", sol.convert_base("Z", 36, 10), "35"))
    return results


# ============================================================
# Main
# ============================================================

def main():
    if len(sys.argv) < 2:
        print("Usage: python evaluate_v3.py <solution.py> [model_name]")
        sys.exit(1)

    solution_path = sys.argv[1]
    model_name = sys.argv[2] if len(sys.argv) > 2 else "unknown"

    print(f"\n{'='*60}")
    print(f"  Gemma Benchmark v3: 50 Programming Tasks")
    print(f"  Model:    {model_name}")
    print(f"  Solution: {solution_path}")
    print(f"{'='*60}\n")

    start = time.time()
    try:
        sol = load_solution(solution_path)
    except Exception as e:
        print(f"FATAL: Could not load solution: {e}")
        traceback.print_exc()
        sys.exit(1)

    total_pass = 0
    total_fail = 0

    test_funcs = [
        # Category 1: Basic Data Structures
        ("1.1 MinStack", test_min_stack),
        ("1.2 Queue from Stacks", test_queue_from_stacks),
        ("1.3 Doubly Linked List", test_doubly_linked_list),
        ("1.4 HashMap", test_hash_map),
        ("1.5 Priority Queue", test_priority_queue),
        # Category 2: String Manipulation
        ("2.1 Run-Length Encoding", test_rle),
        ("2.2 Balanced Brackets", test_balanced_brackets),
        ("2.3 Longest Palindrome", test_longest_palindrome),
        ("2.4 Regex Matcher", test_regex_match),
        ("2.5 String Calculator", test_string_calc),
        # Category 3: Sorting & Searching
        ("3.1 Merge Sort", test_merge_sort),
        ("3.2 Binary Search Range", test_search_range),
        ("3.3 Kth Largest", test_kth_largest),
        ("3.4 Merge K Sorted", test_merge_k_sorted),
        ("3.5 Count Inversions", test_count_inversions),
        # Category 4: Dynamic Programming
        ("4.1 Fibonacci", test_fib),
        ("4.2 Coin Change", test_coin_change),
        ("4.3 LCS", test_lcs),
        ("4.4 Edit Distance", test_edit_distance),
        ("4.5 Knapsack", test_knapsack),
        # Category 5: Graphs (partial)
        ("5.1 BFS Shortest Path", test_bfs_shortest),
        ("5.2 DFS Cycle Detection", test_has_cycle),
        ("5.3 Topological Sort", test_topo_sort),
        # Category 7: Math (partial)
        ("7.1 Prime Sieve", test_primes),
        ("7.2 GCD/LCM", test_gcd_lcm),
        ("7.3 Matrix Multiplication", test_mat_mul),
        # Category 9: Simulation (partial)
        ("9.4 Game of Life", test_life_step),
        ("9.5 Flood Fill", test_flood_fill),
        # Category 10: Utilities (partial)
        ("10.5 Base Converter", test_base_convert),
    ]

    results_log = []
    category_scores = {}

    for section, func in test_funcs:
        cat = section.split(".")[0]
        print(f"--- {section} ---")
        try:
            results = func(sol)
        except Exception as e:
            print(f"  SECTION ERROR: {e}")
            results = []

        section_pass = 0
        section_total = 0
        for r in results:
            name = r[0]
            passed = r[1]
            got = r[2]
            expected = r[3] if len(r) > 3 else None
            symbol = "\u2713" if passed else "\u2717"
            if passed:
                total_pass += 1
                section_pass += 1
            else:
                total_fail += 1
                results_log.append(f"FAIL: {name} \u2014 got {repr(got)}, expected {repr(expected)}")
            section_total += 1
            print(f"  {symbol} {name}")
        print()

        if cat not in category_scores:
            category_scores[cat] = {"pass": 0, "total": 0}
        category_scores[cat]["pass"] += section_pass
        category_scores[cat]["total"] += section_total

    elapsed = time.time() - start
    total = total_pass + total_fail
    pct = (total_pass / total * 100) if total > 0 else 0

    print(f"{'='*60}")
    print(f"  RESULT: {total_pass}/{total} passed ({pct:.0f}%) in {elapsed:.2f}s")
    print(f"{'='*60}")

    print(f"\nCategory Breakdown:")
    cat_names = {
        "1": "Data Structures", "2": "Strings", "3": "Sort/Search",
        "4": "Dynamic Prog", "5": "Graphs", "7": "Math",
        "9": "Simulation", "10": "Utilities"
    }
    for cat in sorted(category_scores.keys()):
        cs = category_scores[cat]
        name = cat_names.get(cat, f"Cat {cat}")
        cpct = (cs["pass"] / cs["total"] * 100) if cs["total"] > 0 else 0
        print(f"  Cat {cat} ({name}): {cs['pass']}/{cs['total']} ({cpct:.0f}%)")

    if results_log:
        print(f"\nFailures for {model_name}:")
        for f in results_log:
            print(f"  {f}")

    # Write summary
    import json
    score_path = solution_path.replace(".py", "_score.json")
    with open(score_path, "w") as sf:
        json.dump({
            "model": model_name,
            "total_pass": total_pass,
            "total_tests": total,
            "percentage": round(pct, 1),
            "elapsed": round(elapsed, 2),
            "categories": category_scores,
            "failures": results_log,
        }, sf, indent=2)

    return 0 if total_fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
