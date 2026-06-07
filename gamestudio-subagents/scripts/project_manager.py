#!/usr/bin/env python3
"""
Game Studio Project Manager
Manage multiple projects: status, resume, start over, freeze

Author: Tuna Pamir (https://github.com/pamirtuna)
Project: Game Studio Sub-Agents
License: MIT
"""

import os
import json
import sys
from datetime import datetime
from pathlib import Path
import shutil


class ProjectManager:
    def __init__(self):
        self.base_path = Path("projects")
        self.base_path.mkdir(exist_ok=True)
        
    def list_projects(self):
        """List all existing projects with their status"""
        if not self.base_path.exists():
            print("No projects directory found. Run 'python scripts/init_project.py' first.")
            return []
            
        projects = []
        for project_dir in self.base_path.iterdir():
            if project_dir.is_dir():
                config_file = project_dir / "project-config.json"
                if config_file.exists():
                    try:
                        with open(config_file, 'r') as f:
                            config = json.load(f)
                        projects.append({
                            'name': project_dir.name,
                            'display_name': config.get('project', {}).get('name', project_dir.name),
                            'status': config.get('project', {}).get('status', 'active'),
                            'phase': config.get('project', {}).get('phase', 'unknown'),
                            'mode': config.get('project', {}).get('mode', 'unknown'),
                            'created': config.get('project', {}).get('created', 'unknown'),
                            'last_modified': datetime.fromtimestamp(config_file.stat().st_mtime).isoformat()
                        })
                    except Exception as e:
                        print(f"Warning: Could not read config for {project_dir.name}: {e}")
        
        return projects
    
    def show_status(self, project_name=None):
        """Show status of all projects or a specific project"""
        projects = self.list_projects()
        
        if not projects:
            print("No projects found.")
            print("\nTo create your first project:")
            print("  python scripts/init_project.py")
            return
            
        if project_name:
            project = next((p for p in projects if p['name'] == project_name or p['display_name'] == project_name), None)
            if not project:
                print(f"Project '{project_name}' not found.")
                return
            projects = [project]
        
        print("\n" + "="*80)
        print("GAME STUDIO PROJECTS STATUS")
        print("="*80)
        
        for project in projects:
            status_color = {
                'active': '🟢',
                'paused': '🟡', 
                'frozen': '🔵',
                'completed': '✅',
                'cancelled': '❌'
            }.get(project['status'], '⚪')
            
            print(f"\n{status_color} {project['display_name']}")
            print(f"   Folder: {project['name']}")
            print(f"   Status: {project['status'].upper()}")
            print(f"   Phase: {project['phase']}")
            print(f"   Mode: {project['mode']}")
            print(f"   Created: {project['created'][:10] if project['created'] != 'unknown' else 'unknown'}")
            print(f"   Modified: {project['last_modified'][:10]}")
            
            # Show project path and key files
            project_path = self.base_path / project['name']
            config_file = project_path / "project-config.json"
            
            if config_file.exists():
                try:
                    with open(config_file, 'r') as f:
                        config = json.load(f)
                    
                    team = config.get('team', {})
                    active_agents = team.get('active_agents', [])
                    print(f"   Agents: {len(active_agents)} active")
                    
                    milestones = config.get('milestones', [])
                    if milestones:
                        current_milestone = milestones[0]
                        print(f"   Current Milestone: {current_milestone.get('name', 'unknown')}")
                
                except Exception as e:
                    print(f"   Warning: Could not read project details: {e}")
        
        print(f"\nTotal projects: {len(projects)}")
        
        if not project_name:
            print("\nProject Management Commands:")
            print("  python scripts/project_manager.py status [project-name]  # Show detailed status")
            print("  python scripts/project_manager.py resume [project-name]  # Resume work")
            print("  python scripts/project_manager.py freeze [project-name]  # Freeze project")
            print("  python scripts/project_manager.py startover [project-name]  # Start over")
    
    def resume_project(self, project_name):
        """Resume work on a specific project"""
        projects = self.list_projects()
        project = next((p for p in projects if p['name'] == project_name or p['display_name'] == project_name), None)
        
        if not project:
            print(f"Project '{project_name}' not found.")
            self.show_status()
            return
            
        project_path = self.base_path / project['name']
        config_file = project_path / "project-config.json"
        
        print(f"\n🚀 RESUMING PROJECT: {project['display_name']}")
        print("="*60)
        
        # Update status to active
        if config_file.exists():
            with open(config_file, 'r') as f:
                config = json.load(f)
            
            config['project']['status'] = 'active'
            config['project']['last_resumed'] = datetime.now().isoformat()
            
            with open(config_file, 'w') as f:
                json.dump(config, f, indent=2)
            
            print(f"📁 Project Location: {project_path.absolute()}")
            print(f"🎯 Current Phase: {project['phase']}")
            print(f"🤖 Mode: {project['mode']}")
            
            # Show team and next steps
            team = config.get('team', {})
            active_agents = team.get('active_agents', [])
            print(f"👥 Active Agents: {', '.join(active_agents)}")
            
            print("\n" + "-"*60)
            print("NEXT STEPS:")
            print("-"*60)
            print(f"📁 Navigate to project: cd projects/{project['name']}")
            print()
            
            if project['phase'] == 'Market Analysis':
                print("1. Start with Market Analysis:")
                print(f"   claude 'Read agents/market_analyst.md and analyze the market for this project'")
                print("2. Then proceed with Project Orchestrator:")
                print("   claude 'Read agents/project_orchestrator.md and continue the project'")
            elif project['phase'] == 'Initialization':
                print("1. Activate Project Orchestrator:")
                print(f"   claude 'Read agents/project_orchestrator.md and resume {project['display_name']}'")
            else:
                print("1. Continue with Producer Agent:")
                print(f"   claude 'Read agents/producer_agent.md and resume work on {project['display_name']}'")
                print("2. Get status update:")
                print("   claude 'Read project-config.json and give me a current status report'")
            
            print("\n💡 Note: This project uses project-specific agents in the agents/ folder")
            
            print(f"\n✅ Project '{project['display_name']}' is now active and ready for development!")
        
    def freeze_project(self, project_name):
        """Freeze a project (pause indefinitely)"""
        projects = self.list_projects()
        project = next((p for p in projects if p['name'] == project_name or p['display_name'] == project_name), None)
        
        if not project:
            print(f"Project '{project_name}' not found.")
            return
            
        project_path = self.base_path / project['name']
        config_file = project_path / "project-config.json"
        
        print(f"\n🔵 FREEZING PROJECT: {project['display_name']}")
        
        reason = input("Reason for freezing (optional): ").strip()
        
        if config_file.exists():
            with open(config_file, 'r') as f:
                config = json.load(f)
            
            config['project']['status'] = 'frozen'
            config['project']['frozen_date'] = datetime.now().isoformat()
            if reason:
                config['project']['freeze_reason'] = reason
            
            with open(config_file, 'w') as f:
                json.dump(config, f, indent=2)
            
            print(f"❄️ Project '{project['display_name']}' has been frozen.")
            print("To resume later: python scripts/project_manager.py resume " + project['name'])
    
    def start_over(self, project_name):
        """Start over a project (reset to initial state)"""
        projects = self.list_projects()
        project = next((p for p in projects if p['name'] == project_name or p['display_name'] == project_name), None)
        
        if not project:
            print(f"Project '{project_name}' not found.")
            return
            
        project_path = self.base_path / project['name']
        
        print(f"\n⚠️  START OVER: {project['display_name']}")
        print("="*60)
        print("This will:")
        print("- Reset project to initial state")
        print("- Keep project structure and config")
        print("- Clear all progress and documentation")
        print("- Backup current state")
        
        confirm = input("\nAre you sure you want to start over? (type 'YES' to confirm): ").strip()
        
        if confirm != 'YES':
            print("Operation cancelled.")
            return
        
        # Create backup
        backup_name = f"{project['name']}_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        backup_path = self.base_path / backup_name
        
        print(f"\n📦 Creating backup: {backup_name}")
        shutil.copytree(project_path, backup_path)
        
        # Reset project
        config_file = project_path / "project-config.json"
        if config_file.exists():
            with open(config_file, 'r') as f:
                config = json.load(f)
            
            # Reset project state
            config['project']['phase'] = 'Market Analysis'
            config['project']['status'] = 'active'
            config['project']['version'] = '1.0.0'
            config['project']['reset_date'] = datetime.now().isoformat()
            config['project']['backup_location'] = str(backup_path)
            
            # Clear progress tracking
            if 'progress' in config:
                del config['progress']
            if 'completed_milestones' in config:
                del config['completed_milestones']
            
            with open(config_file, 'w') as f:
                json.dump(config, f, indent=2)
        
        # Clear documentation except templates
        doc_path = project_path / "documentation"
        if doc_path.exists():
            for item in doc_path.rglob("*"):
                if item.is_file() and not item.name.endswith("_template.md"):
                    item.unlink()
        
        print(f"✅ Project '{project['display_name']}' has been reset!")
        print(f"📦 Backup saved to: {backup_path}")
        print("\nTo restart development:")
        print("  python scripts/project_manager.py resume " + project['name'])
    
    def create_new_project(self):
        """Shortcut to create new project"""
        print("Launching project initialization...")
        os.system("python scripts/init_project.py")
    
    def main_menu(self):
        """Interactive main menu"""
        while True:
            print("\n" + "="*60)
            print("🎮 GAME STUDIO PROJECT MANAGER")
            print("="*60)
            print("1. Show all projects status")
            print("2. Create new project")
            print("3. Resume project")
            print("4. Freeze project")
            print("5. Start over project")
            print("6. Exit")
            
            choice = input("\nSelect option (1-6): ").strip()
            
            if choice == '1':
                self.show_status()
            elif choice == '2':
                self.create_new_project()
            elif choice == '3':
                projects = self.list_projects()
                if not projects:
                    print("No projects found. Create one first.")
                    continue
                print("\nAvailable projects:")
                for i, p in enumerate(projects, 1):
                    print(f"  {i}. {p['display_name']} ({p['status']})")
                try:
                    proj_choice = int(input("Select project number: ")) - 1
                    if 0 <= proj_choice < len(projects):
                        self.resume_project(projects[proj_choice]['name'])
                    else:
                        print("Invalid choice.")
                except ValueError:
                    print("Invalid input.")
            elif choice == '4':
                projects = self.list_projects()
                if not projects:
                    print("No projects found.")
                    continue
                print("\nAvailable projects:")
                for i, p in enumerate(projects, 1):
                    print(f"  {i}. {p['display_name']} ({p['status']})")
                try:
                    proj_choice = int(input("Select project number: ")) - 1
                    if 0 <= proj_choice < len(projects):
                        self.freeze_project(projects[proj_choice]['name'])
                    else:
                        print("Invalid choice.")
                except ValueError:
                    print("Invalid input.")
            elif choice == '5':
                projects = self.list_projects()
                if not projects:
                    print("No projects found.")
                    continue
                print("\nAvailable projects:")
                for i, p in enumerate(projects, 1):
                    print(f"  {i}. {p['display_name']} ({p['status']})")
                try:
                    proj_choice = int(input("Select project number: ")) - 1
                    if 0 <= proj_choice < len(projects):
                        self.start_over(projects[proj_choice]['name'])
                    else:
                        print("Invalid choice.")
                except ValueError:
                    print("Invalid input.")
            elif choice == '6':
                print("Goodbye! 🎮")
                break
            else:
                print("Invalid choice. Please select 1-6.")


def main():
    manager = ProjectManager()
    
    if len(sys.argv) == 1:
        # Interactive mode
        manager.main_menu()
    elif len(sys.argv) == 2:
        command = sys.argv[1].lower()
        if command == 'status':
            manager.show_status()
        elif command == 'new':
            manager.create_new_project()
        elif command == 'menu':
            manager.main_menu()
        else:
            print(f"Unknown command: {command}")
            print("Usage: python scripts/project_manager.py [status|new|menu|resume|freeze|startover] [project-name]")
    elif len(sys.argv) == 3:
        command, project_name = sys.argv[1].lower(), sys.argv[2]
        if command == 'status':
            manager.show_status(project_name)
        elif command == 'resume':
            manager.resume_project(project_name)
        elif command == 'freeze':
            manager.freeze_project(project_name)
        elif command == 'startover':
            manager.start_over(project_name)
        else:
            print(f"Unknown command: {command}")
            print("Usage: python scripts/project_manager.py [status|resume|freeze|startover] [project-name]")
    else:
        print("Usage: python scripts/project_manager.py [command] [project-name]")
        print("Commands: status, new, resume, freeze, startover, menu")


if __name__ == "__main__":
    main()