from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
from deadlock_logic import Resource, Process, DeadlockGraph, BankersAlgorithm, MultiInstanceDetection
from recovery import select_victim, simulate_recovery


app = Flask(__name__)
CORS(app)


@app.route('/api/simulate', methods=['POST'])
def simulate():
    data = request.json
    if data and 'resources' in data and 'steps' in data:
        resources = {name: Resource(name, units) for name, units in data['resources'].items()}
        processes = {name: Process(name) for name in data.get('processes', [])}
        
        sim_steps = []
        for step in data['steps']:
            p_name = step['process']
            r_name = step['resource']
            units = step.get('units', 1)
            
            if p_name not in processes:
                processes[p_name] = Process(p_name)
            
            p = processes[p_name]
            r = resources[r_name]
            success = p.request_resource(r, units)
            sim_steps.append({"action": f"{p_name} requests {r_name}", "success": success})
            
        return jsonify({
            "steps": sim_steps,
            "deadlock": data.get('expected_deadlock', True), 
            "resources": {name: r.allocated_units for name, r in resources.items()},
            "processes": {name: p.allocated_resources for name, p in processes.items()}
        })

    return jsonify({"error": "No simulation data provided"}), 400

@app.route('/api/detect', methods=['POST'])
def detect():
    data = request.json
    graph = DeadlockGraph()
    for node in data.get('nodes', []):
        graph.add_node(node)
    for edge in data.get('edges', []):
        graph.add_edge(edge[0], edge[1])
    
    is_deadlock = graph.detect_deadlock()
    return jsonify({"deadlock": is_deadlock})

@app.route('/api/detect/multi', methods=['POST'])
def detect_multi():
    data = request.json
    # Expected: {available: [], allocation: [[]], request: [[]]}
    available = data.get('available')
    allocation = data.get('allocation')
    request_matrix = data.get('request')
    
    print("--- DEBUG MULTI INSTANCE ---")
    print(f"Available: {available}")
    print(f"Allocation: {allocation}")
    print(f"Request: {request_matrix}")

    deadlock, deadlocked_procs = MultiInstanceDetection.detect(available, allocation, request_matrix)
    
    print(f"Result: {deadlock}, Procs: {deadlocked_procs}")
    
    return jsonify({
        "deadlock": deadlock,
        "deadlocked_processes": deadlocked_procs
    })

@app.route('/api/banker/safe', methods=['POST'])
def banker_safe():
    data = request.json
    total = data.get('total')
    max_demand = data.get('max_demand')
    allocation = data.get('allocation')
    
    banker = BankersAlgorithm(total, max_demand, allocation)
    is_safe, sequence = banker.is_safe()
    return jsonify({"safe": is_safe, "sequence": [f"P{i+1}" for i in sequence]})

@app.route('/api/banker/request', methods=['POST'])
def banker_request():
    try:
        data = request.json
        total = data.get('total')
        max_demand = data.get('max_demand')
        allocation = data.get('allocation')
        process_idx = data.get('process_idx')
        req_units = data.get('request')
        
        print(f"=== BANKER REQUEST ===")
        print(f"Total: {total}, Type: {type(total)}")
        print(f"Allocation: {allocation}")
        print(f"Process: {process_idx}, Request: {req_units}")
        
        banker = BankersAlgorithm(total, max_demand, allocation)
        granted, sequence = banker.request_resources(process_idx, req_units)
        
        print(f"Granted: {granted}, Sequence: {sequence}")
        
        return jsonify({
            "granted": granted,
            "sequence": [f"P{i+1}" for i in sequence] if granted else [],
            "new_allocation": banker.allocation.tolist() if granted else allocation,
            "new_available": banker.available.tolist() if granted else None
        })
    except Exception as e:
        print(f"ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e), "granted": False}), 500

@app.route('/api/recovery', methods=['POST'])
def recovery():
    data = request.json
    processes = data.get('processes')
    allocation = data.get('allocation')
    max_demand = data.get('max_demand')
    resources = data.get('resources') or []
    
    victim = select_victim(processes, allocation, max_demand, resources)
    if not victim:
        return jsonify({"error": "No victim found"}), 404
        
    new_allocation = simulate_recovery(allocation, victim['index'])
    return jsonify({
        "victim": victim,
        "new_allocation": new_allocation
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
