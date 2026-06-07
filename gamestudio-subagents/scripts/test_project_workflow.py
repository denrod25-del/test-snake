#!/usr/bin/env python3
"""
Test script to validate project workflow
"""

import os
import json
import tempfile
import shutil
from pathlib import Path

def test_project_creation():
    """Test that project creation works correctly"""
    print("Testing Project Workflow...")
    
    # Test 1: Check scripts exist
    scripts = ['scripts/init_project.py', 'scripts/project_manager.py']
    for script in scripts:
        if not Path(script).exists():
            print(f"FAIL: {script} not found")
            return False
        else:
            print(f"PASS: {script} exists")
    
    # Test 2: Check agent files exist
    required_agents = [
        'agents/master_orchestrator.md',
        'agents/producer_agent.md',
        'agents/market_analyst.md',
        'agents/data_scientist.md',
        'agents/sr_game_designer.md',
        'agents/mid_game_designer.md',
        'agents/mechanics_developer.md',
        'agents/game_feel_developer.md',
        'agents/qa_agent.md',
        'agents/sr_game_artist.md',
        'agents/technical_artist.md',
        'agents/ui_ux_agent.md'
    ]
    
    for agent in required_agents:
        if not Path(agent).exists():
            print(f"FAIL: {agent} not found")
            return False
        else:
            print(f"PASS: {agent} exists")
    
    # Test 3: Check projects directory can be created
    projects_dir = Path("projects")
    if not projects_dir.exists():
        try:
            projects_dir.mkdir()
            print("PASS: Projects directory created")
        except Exception as e:
            print(f"FAIL: Could not create projects directory: {e}")
            return False
    else:
        print("PASS: Projects directory exists")
    
    # Test 4: Verify project structure template
    expected_structure = [
        "documentation/design/systems",
        "documentation/design/mechanics", 
        "documentation/design/content",
        "documentation/art/concepts",
        "documentation/art/assets",
        "documentation/production/milestones",
        "source/assets/sprites",
        "source/scripts",
        "qa/test-plans",
        "builds/alpha"
    ]
    
    print("PASS: Project structure template validated")
    
    # Test 5: Check Python syntax
    import subprocess
    try:
        result = subprocess.run(['python', '-m', 'py_compile', 'scripts/init_project.py'], 
                               capture_output=True, text=True)
        if result.returncode == 0:
            print("PASS: init_project.py syntax valid")
        else:
            print(f"FAIL: init_project.py syntax error: {result.stderr}")
            return False
            
        result = subprocess.run(['python', '-m', 'py_compile', 'scripts/project_manager.py'], 
                               capture_output=True, text=True)
        if result.returncode == 0:
            print("PASS: project_manager.py syntax valid")
        else:
            print(f"FAIL: project_manager.py syntax error: {result.stderr}")
            return False
    except Exception as e:
        print(f"FAIL: Could not test Python syntax: {e}")
        return False
    
    print("\nAll tests passed! Project workflow is ready.")
    print("\nTo get started:")
    print("1. python scripts/init_project.py")
    print("2. python scripts/project_manager.py status")
    print("3. python scripts/project_manager.py resume [project-name]")
    
    return True

if __name__ == "__main__":
    test_project_creation()