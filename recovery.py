import numpy as np

def select_victim(processes, allocation, max_demand, resources):
    """
    Selects a process to terminate to break a deadlock.
    Heuristic: Terminate the process holding the most resources but having the least remaining need.
    """
    if not processes:
        return None
    
    # Simple cost function: cost = (total_allocated) / (remaining_need + 1)
    # Higher cost = better victim candidate (holding much, needing little more)
    costs = []
    for i in range(len(processes)):
        allocated_total = np.sum(allocation[i])
        need_total = np.sum(np.array(max_demand[i]) - np.array(allocation[i]))
        cost = allocated_total / (need_total + 1)
        costs.append(cost)
    
    victim_idx = np.argmax(costs)
    return {
        "index": int(victim_idx),
        "name": processes[victim_idx],
        "released": allocation[victim_idx].tolist()
    }

def simulate_recovery(allocation, victim_idx):
    """
    Returns a new allocation matrix with the victim's resources released.
    """
    new_allocation = np.array(allocation).copy()
    new_allocation[victim_idx] = 0
    return new_allocation.tolist()
