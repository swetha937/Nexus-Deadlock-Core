import numpy as np

class Resource:
    def __init__(self, name, total_units):
        self.name = name
        self.total_units = total_units
        self.allocated_units = 0

    def allocate(self, units):
        if self.total_units - self.allocated_units >= units:
            self.allocated_units += units
            return True
        return False

    def release(self, units):
        if self.allocated_units >= units:
            self.allocated_units -= units
            return True
        return False

class Process:
    def __init__(self, name):
        self.name = name
        self.allocated_resources = {} # resource_name: units

    def request_resource(self, resource, units):
        if resource.allocate(units):
            self.allocated_resources[resource.name] = self.allocated_resources.get(resource.name, 0) + units
            return True
        return False

    def release_resources(self, resources_dict):
        # resources_dict: {resource_obj: units}
        for resource, units in resources_dict.items():
            if resource.name in self.allocated_resources and self.allocated_resources[resource.name] >= units:
                resource.release(units)
                self.allocated_resources[resource.name] -= units

class DeadlockGraph:
    def __init__(self):
        self.adjacency_list = {}
    
    def add_node(self, node):
        if node not in self.adjacency_list:
            self.adjacency_list[node] = []

    def add_edge(self, from_node, to_node):
        self.add_node(from_node)
        self.add_node(to_node)
        if to_node not in self.adjacency_list[from_node]:
            self.adjacency_list[from_node].append(to_node)

    def detect_deadlock(self):
        visited = set()
        rec_stack = set()
        def dfs(node):
            if node in rec_stack:
                return True
            if node in visited:
                return False
            visited.add(node)
            rec_stack.add(node)
            for neighbor in self.adjacency_list.get(node, []):
                if dfs(neighbor):
                    return True
            rec_stack.remove(node)
            return False
        for node in self.adjacency_list:
            if dfs(node):
                return True
        return False

class BankersAlgorithm:
    def __init__(self, total_resources, max_demand, allocation):
        # Inputs are numpy arrays or lists
        self.total_resources = np.array(total_resources)
        self.max_demand = np.array(max_demand)
        self.allocation = np.array(allocation)
        self.need = self.max_demand - self.allocation
        self.available = self.total_resources - np.sum(self.allocation, axis=0)
        
    def is_safe(self):
        work = self.available.copy()
        finish = [False] * len(self.allocation)
        safe_sequence = []

        while len(safe_sequence) < len(self.allocation):
            progress = False
            for i in range(len(self.allocation)):
                if not finish[i] and all(self.need[i] <= work):
                    work += self.allocation[i]
                    finish[i] = True
                    safe_sequence.append(i)
                    progress = True
            if not progress:
                break
        
        if len(safe_sequence) == len(self.allocation):
            return True, [int(i) for i in safe_sequence]
        else:
            return False, []

    def request_resources(self, process_idx, request):
        request = np.array(request)
        if all(request <= self.need[process_idx]) and all(request <= self.available):
            self.available -= request
            self.allocation[process_idx] += request
            self.need[process_idx] -= request
            is_safe, safe_sequence = self.is_safe()
            if is_safe:
                return True, safe_sequence
            else:
                self.available += request
                self.allocation[process_idx] -= request
                self.need[process_idx] += request
        return False, []

class MultiInstanceDetection:
    @staticmethod
    def detect(available, allocation, request):
        """
        Matrix-based detection algorithm for multi-instance resources.
        """
        work = np.array(available, dtype=int)
        allocation = np.array(allocation, dtype=int)
        request = np.array(request, dtype=int)
        num_procs = len(allocation)
        
        finish = [False] * num_procs
        for i in range(num_procs):
            if np.all(allocation[i] == 0):
                finish[i] = True
        
        while True:
            found = False
            for i in range(num_procs):
                if not finish[i] and np.all(request[i] <= work):
                    work += allocation[i]
                    finish[i] = True
                    found = True
            if not found:
                break
        
        deadlocked_procs = [i for i, f in enumerate(finish) if not f]
        return len(deadlocked_procs) > 0, deadlocked_procs

