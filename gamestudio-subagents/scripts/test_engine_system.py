#!/usr/bin/env python3
"""
Test Engine-Specific System
Validates that engine configurations and project-specific agents work correctly
"""

import json
import tempfile
import shutil
from pathlib import Path
from agent_customizer import AgentCustomizer


def test_engine_configs():
    """Test that all engine configurations are valid"""
    print("Testing Engine Configurations...")
    
    engines = ["godot", "unity", "unreal"]
    engine_configs_path = Path("engine_configs")
    
    for engine in engines:
        config_file = engine_configs_path / f"{engine}_config.json"
        
        if not config_file.exists():
            print(f"FAIL: {engine} config not found")
            return False
        
        try:
            with open(config_file, 'r') as f:
                config = json.load(f)
            
            # Validate required fields
            required_fields = ["engine", "best_practices", "agent_specializations"]
            for field in required_fields:
                if field not in config:
                    print(f"FAIL: {engine} config missing {field}")
                    return False
            
            print(f"PASS: {engine} config valid")
            
        except json.JSONDecodeError as e:
            print(f"FAIL: {engine} config invalid JSON: {e}")
            return False
        except Exception as e:
            print(f"FAIL: {engine} config error: {e}")
            return False
    
    return True


def test_agent_customization():
    """Test that agent customization works for each engine"""
    print("\nTesting Agent Customization...")
    
    # Create a temporary project config
    test_config = {
        "project": {
            "name": "Test Game",
            "engine": "Godot",
            "platform": "PC",
            "genre": "Action",
            "phase": "Development"
        },
        "team": {
            "active_agents": [
                "mechanics_developer",
                "game_feel_developer", 
                "technical_artist",
                "ui_ux_agent",
                "sr_game_artist",
                "qa_agent"
            ]
        }
    }
    
    engines_to_test = ["Godot", "Unity", "Unreal Engine"]
    
    for engine in engines_to_test:
        print(f"\nTesting {engine} customization...")
        
        # Update config for this engine
        test_config["project"]["engine"] = engine
        
        # Create temporary directory
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            try:
                # Test agent customization
                customizer = AgentCustomizer()
                customizer.customize_agents_for_project(temp_path, test_config)
                
                # Check that agents folder was created
                agents_path = temp_path / "agents"
                if not agents_path.exists():
                    print(f"FAIL: {engine} - agents folder not created")
                    return False
                
                # Check that agents were customized
                active_agents = test_config["team"]["active_agents"]
                for agent_name in active_agents:
                    agent_file = agents_path / f"{agent_name}.md"
                    if not agent_file.exists():
                        print(f"FAIL: {engine} - {agent_name} not created")
                        return False
                    
                    # Check that agent contains engine-specific content
                    with open(agent_file, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    if engine not in content:
                        print(f"FAIL: {engine} - {agent_name} not customized")
                        return False
                
                # Check that project orchestrator was created
                orchestrator_file = agents_path / "project_orchestrator.md"
                if not orchestrator_file.exists():
                    print(f"FAIL: {engine} - project orchestrator not created")
                    return False
                
                print(f"PASS: {engine} customization works")
                
            except Exception as e:
                print(f"FAIL: {engine} customization error: {e}")
                return False
    
    return True


def test_folder_structures():
    """Test that engine-specific folder structures are correct"""
    print("\nTesting Folder Structures...")
    
    # Import the ProjectInitializer to test folder creation
    import sys
    sys.path.append('scripts')
    from init_project import ProjectInitializer
    
    initializer = ProjectInitializer()
    
    # Test each engine's folder structure
    engines = {
        "Godot": "get_godot_structure",
        "Unity": "get_unity_structure", 
        "Unreal": "get_unreal_structure"
    }
    
    for engine, method_name in engines.items():
        try:
            method = getattr(initializer, method_name)
            structure = method()
            
            if not structure or len(structure) == 0:
                print(f"FAIL: {engine} structure is empty")
                return False
            
            # Check for engine-specific folders
            structure_str = " ".join(structure)
            
            if engine == "Godot":
                required = ["scenes", "scripts", "autoload"]
                if not all(req in structure_str for req in required):
                    print(f"FAIL: {engine} missing required folders")
                    return False
            elif engine == "Unity":
                required = ["Assets", "Scripts", "Scenes", "Prefabs"]
                if not all(req in structure_str for req in required):
                    print(f"FAIL: {engine} missing required folders")
                    return False
            elif engine == "Unreal":
                required = ["Content", "Blueprints", "Maps", "Source"]
                if not all(req in structure_str for req in required):
                    print(f"FAIL: {engine} missing required folders")
                    return False
            
            print(f"PASS: {engine} folder structure valid")
            
        except Exception as e:
            print(f"FAIL: {engine} structure error: {e}")
            return False
    
    return True


def test_project_files():
    """Test that engine-specific project files are created correctly"""
    print("\nTesting Engine Project Files...")
    
    import sys
    sys.path.append('scripts')
    from init_project import ProjectInitializer
    
    initializer = ProjectInitializer()
    
    engines = ["Godot", "Unity", "Unreal"]
    
    for engine in engines:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir) / "test-project"
            temp_path.mkdir(parents=True)
            
            try:
                # Create engine-specific files
                initializer.create_engine_files(temp_path, engine)
                
                source_path = temp_path / "source"
                
                if engine == "Godot":
                    project_file = source_path / "project.godot"
                    if not project_file.exists():
                        print(f"FAIL: {engine} - project.godot not created")
                        return False
                    
                    # Check content
                    with open(project_file, 'r') as f:
                        content = f.read()
                    if "[application]" not in content:
                        print(f"FAIL: {engine} - project.godot invalid content")
                        return False
                
                elif engine == "Unity":
                    manifest_file = source_path / "Packages" / "manifest.json"
                    if not manifest_file.exists():
                        print(f"FAIL: {engine} - manifest.json not created")
                        return False
                    
                    # Check content
                    with open(manifest_file, 'r') as f:
                        content = f.read()
                    if "dependencies" not in content:
                        print(f"FAIL: {engine} - manifest.json invalid content")
                        return False
                
                elif engine == "Unreal":
                    uproject_file = source_path / f"{temp_path.name}.uproject"
                    if not uproject_file.exists():
                        print(f"FAIL: {engine} - .uproject not created")
                        return False
                    
                    # Check content
                    with open(uproject_file, 'r') as f:
                        content = f.read()
                    if "FileVersion" not in content:
                        print(f"FAIL: {engine} - .uproject invalid content")
                        return False
                
                print(f"PASS: {engine} project files created correctly")
                
            except Exception as e:
                print(f"FAIL: {engine} project files error: {e}")
                return False
    
    return True


def run_all_tests():
    """Run all engine system tests"""
    print("TESTING ENGINE-SPECIFIC SYSTEM")
    print("="*50)
    
    tests = [
        ("Engine Configurations", test_engine_configs),
        ("Agent Customization", test_agent_customization),
        ("Folder Structures", test_folder_structures),
        ("Project Files", test_project_files),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n[TESTING] {test_name}")
        print("-" * 30)
        
        try:
            if test_func():
                passed += 1
                print(f"PASS: {test_name} - ALL TESTS PASSED")
            else:
                print(f"FAIL: {test_name} - SOME TESTS FAILED")
        except Exception as e:
            print(f"ERROR: {test_name} - {e}")
    
    print("\n" + "="*50)
    print(f"RESULTS: {passed}/{total} test suites passed")
    
    if passed == total:
        print("ALL ENGINE TESTS PASSED!")
        print("\nThe system is ready for engine-specific development:")
        print("- Engine configurations are valid")
        print("- Agent customization works for all engines") 
        print("- Folder structures follow engine conventions")
        print("- Project files are created correctly")
        print("\nUsers can now create optimized projects for any engine!")
        return True
    else:
        print(f"FAILED: {total - passed} test suite(s) failed")
        print("Please fix the issues before using the system.")
        return False


if __name__ == "__main__":
    run_all_tests()