# Game Studio Sub-Agents - Setup Guide

## System Requirements

**Minimum:**
- Windows 10, macOS 10.15, or Ubuntu 18.04+
- 4GB RAM
- 2GB free disk space
- Internet connection

**Recommended:**
- Windows 11, macOS 12+, or Ubuntu 20.04+
- 8GB RAM
- 5GB free disk space
- Stable internet connection

**Required Software:**
- Git (any recent version)
- Python 3.8 or higher
- Node.js 16+ (for Claude Code and diagram support)
- Claude Code CLI

## Quick Start (5 minutes)

### 1. Prerequisites

#### A. Git (Version Control)
```bash
# Windows
# Option 1: Download from https://git-scm.com/
# Option 2: Using Chocolatey
choco install git

# macOS
# Option 1: Install Xcode Command Line Tools
xcode-select --install
# Option 2: Using Homebrew
brew install git

# Linux (Ubuntu/Debian)
sudo apt update
sudo apt install git

# Verify installation
git --version
```

#### B. Python 3.8+ 
```bash
# Windows
# Download from https://www.python.org/downloads/
# Make sure to check "Add Python to PATH"
# Or using Chocolatey:
choco install python

# macOS
# Option 1: Download from python.org
# Option 2: Using Homebrew
brew install python

# Linux (Ubuntu/Debian)
sudo apt update
sudo apt install python3 python3-pip python3-venv

# Verify installation
python --version  # or python3 --version on Linux/macOS
pip --version     # or pip3 --version on Linux/macOS
```

#### C. Node.js (for diagram support and package management)
```bash
# Windows
# Download from https://nodejs.org/
# Or using Chocolatey:
choco install nodejs

# macOS
# Download from nodejs.org
# Or using Homebrew:
brew install node

# Linux (Ubuntu/Debian)
# Install LTS version
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

#### D. Claude Code CLI
```bash
# Method 1: Install via npm (requires Node.js)
npm install -g @anthropic-ai/claude-code

# Method 2: Download directly
# Visit: https://claude.ai/code
# Download for your platform (Windows/macOS/Linux)

# Verify installation
claude --version

# Login to Claude (required)
claude auth login
# Follow the prompts to authenticate
```

#### E. Optional: Package Managers (recommended)

**Windows - Chocolatey:**
```powershell
# Run as Administrator in PowerShell
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
```

**macOS - Homebrew:**
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. Installation

```bash
# 1. Clone the repository
git clone https://github.com/pamirtuna/gamestudio-subagents.git
cd gamestudio-subagents

# 2. Create a virtual environment (recommended)
python -m venv venv

# 3. Activate virtual environment
# Windows (Command Prompt):
venv\Scripts\activate
# Windows (PowerShell):
venv\Scripts\Activate.ps1
# macOS/Linux:
source venv/bin/activate

# 4. Verify everything is working
python --version
claude --version
git --version
node --version

# No additional Python dependencies required for basic setup!
```

### 3. Create Your First Project

```bash
# Run the project initializer
python scripts/init_project.py

# Follow the interactive prompts:
# - Enter project name
# - Describe your game concept
# - Select platform, audience, mode, etc.
# - Define development rules and standards
```

### 4. Start Development with Claude

```bash
# Option 1: Using Claude Code
claude "Read agents/master_orchestrator.md and start working on the project I just created"

# Option 2: Manual agent activation
claude "I want to create a [type] game. Read agents/master_orchestrator.md and help me get started"
```

## Detailed Setup

### System Requirements

**Minimum:**
- Python 3.8+
- 4GB RAM
- 1GB free disk space

**Recommended:**
- Python 3.10+
- 8GB RAM
- 5GB free disk space (for multiple projects)
- Claude Code installed
- VS Code or similar IDE

### File Structure After Setup

```
gamestudio-subagents/
├── agents/                    # All agent templates
│   ├── master_orchestrator.md # Main controller
│   ├── producer_agent_v2.md   # Project manager
│   └── [other agents].md      # Specialized agents
├── scripts/
│   └── init_project.py        # Project initializer
├── projects/                  # Your game projects (created)
│   └── [your-game]/          # Individual project folders
├── templates/                 # Document templates
├── SETUP.md                  # This file
└── README.md                 # Main documentation
```

### Configuration Options

#### Environment Variables (Optional)

Create a `.env` file in the root directory:

```bash
# Default project location
PROJECTS_PATH=./projects

# Default engine preference
DEFAULT_ENGINE=Godot

# Default team size
DEFAULT_MODE=design

# Claude API settings (if using API directly)
CLAUDE_API_KEY=your_api_key_here
```

#### Custom Templates

You can customize document templates in the `/templates` directory:
- `gdd_template.md` - Game Design Document
- `feature_spec_template.md` - Feature specifications
- `handoff_template.md` - Agent handoff format

## Usage Workflows

### Workflow 1: New Game Concept (Design Only)

```bash
# 1. Initialize project in design mode
python scripts/init_project.py
# Select: Design Only mode

# 2. Activate design agents
claude "Read agents/master_orchestrator.md and activate DESIGN MODE for my project"

# 3. Work through design phases
# The agents will guide you through concept, systems, and documentation
```

### Workflow 2: Full Game Development

```bash
# 1. Initialize project in development mode
python scripts/init_project.py
# Select: Full Development mode

# 2. Activate all agents
claude "Read agents/master_orchestrator.md and begin DEVELOPMENT MODE"

# 3. Follow milestone-based development
# Agents will coordinate implementation, art, QA, etc.
```

### Workflow 3: Rapid Prototype

```bash
# 1. Quick project setup
python scripts/init_project.py
# Select: Prototype mode, Rapid timeline

# 2. Focus on core mechanics
claude "Read agents/producer_agent_v2.md and create a working prototype in 3 days"
```

### Workflow 4: Projects with Custom Development Rules

```bash
# 1. Initialize project with custom rules
python scripts/init_project.py
# When prompted for Development Rules:
# - Enter your coding standards (one per line)
# - Examples: "Use SOLID principles", "No namespaces", "Keep functions under 30 lines"
# - Press Enter on empty line when done

# 2. Rules are saved in project-config.json
# Check your rules:
cat projects/[your-game]/project-config.json | grep -A 10 "development_rules"

# 3. Producer enforces rules
claude "Read agents/producer_agent.md and the project-config.json. Begin development and ensure all agents follow the development rules."
```

### Development Rules Examples

Common rules you might want to set:
- **Architecture**: "Use MVC pattern for all UI code"
- **Performance**: "Maintain 60 FPS on mid-range hardware"  
- **Code Quality**: "All functions must be under 30 lines"
- **Memory**: "Use object pooling for all projectiles"
- **Style**: "No namespaces - keep flat structure"
- **Testing**: "Unit tests required for core mechanics"
- **Documentation**: "Complex algorithms need code comments"

## Working with Agents

### Agent Activation Commands

**Start a conversation with Claude and use these commands:**

```markdown
# Initialize Master Orchestrator
"Read agents/master_orchestrator.md and initialize a new project"

# Activate specific agent
"Read agents/sr_game_designer.md and design the core gameplay loop"

# Check project status
"Read the project-config.json in projects/[name] and give me a status update"

# Transition between phases
"Read agents/producer_agent_v2.md and transition from design to development"
```

### Best Practices

1. **Always start with the Master Orchestrator** - It coordinates everything
2. **Let Producer Agent manage workflow** - Don't activate agents randomly
3. **Follow the phase gates** - Complete design before development
4. **Use project folders** - Keep each project isolated
5. **Document decisions** - Agents will create documentation automatically
6. **Regular status checks** - Ask Producer Agent for updates

## Troubleshooting

### Common Setup Issues

**Issue: "Python command not found"**
```bash
# Windows: Use 'py' instead of 'python'
py --version
py scripts/init_project.py

# Linux/macOS: Use 'python3'
python3 --version
python3 scripts/init_project.py

# Or add Python to PATH (Windows)
# During installation, check "Add Python to PATH"
```

**Issue: "Claude command not found"**
```bash
# Verify Node.js is installed first
node --version
npm --version

# Reinstall Claude Code
npm uninstall -g @anthropic-ai/claude-code
npm install -g @anthropic-ai/claude-code

# Or try direct download from claude.ai/code
```

**Issue: "Permission denied" (macOS/Linux)**
```bash
# Fix npm global permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Then reinstall Claude Code
npm install -g @anthropic-ai/claude-code
```

**Issue: "Git not found"**
```bash
# Windows: Download from git-scm.com
# Make sure to select "Add Git to PATH"

# Verify after installation
git --version

# If still not found, restart terminal/command prompt
```

**Issue: "Virtual environment activation fails"**
```bash
# Windows PowerShell execution policy error
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Alternative: Use Command Prompt instead of PowerShell
# cmd.exe
venv\Scripts\activate
```

**Issue: "Project folder already exists"**
```bash
# Solution: Choose a different project name or delete existing folder
rm -rf projects/[project-name]  # Use with caution!
# Windows:
rmdir /s projects\[project-name]
```

**Issue: "Agent not responding correctly"**
```markdown
# Solution: Ensure you're reading the correct agent file
"Read agents/master_orchestrator.md first, then activate [specific agent]"
```

**Issue: "Confused agent context"**
```markdown
# Solution: Provide project context
"Read the project-config.json in projects/[name], then continue with [task]"
```

**Issue: "Mermaid diagrams not displaying"**
```bash
# GitHub should display them automatically
# For local viewing, install Mermaid CLI
npm install -g @mermaid-js/mermaid-cli

# Or use online viewer: https://mermaid.live/
```

### Getting Help

1. **Check agent documentation** - Each agent has detailed instructions
2. **Review example workflows** - See `example_workflows.md`
3. **GitHub Issues** - Report bugs or request features
4. **Community Discord** - Join discussions (link in README)

## Advanced Configuration

### Custom Agent Creation

To create a custom agent:

1. Copy an existing agent template
2. Modify responsibilities and protocols
3. Update `master_orchestrator.md` to recognize new agent
4. Add to appropriate workflow in `producer_agent_v2.md`

### Integration with External Tools

**Game Engines:**
```python
# In project-config.json, specify engine-specific settings
{
  "engine_config": {
    "godot": {
      "version": "4.2",
      "export_templates": true
    }
  }
}
```

**Version Control:**
```bash
# Initialize git in your project
cd projects/[your-game]
git init
git add .
git commit -m "Initial project setup"
```

**CI/CD Pipeline:**
```yaml
# .github/workflows/build.yml (in your project)
name: Build Game
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Build with Godot
        run: godot --export
```

## Platform-Specific Notes

### Windows
- Use `python` instead of `python3`
- Path separator is `\` instead of `/`
- Run `.bat` scripts instead of `.sh`

### macOS
- May need to use `python3` explicitly
- Grant terminal permissions for script execution
- Use `chmod +x scripts/init_project.py` if needed

### Linux
- Usually works out of the box
- May need to install python3-venv: `sudo apt install python3-venv`

## Next Steps

1. ✅ Complete setup
2. ✅ Create your first project
3. 📚 Read agent documentation
4. 🎮 Start building your game!
5. 🤝 Share your experience

## Support

- **Documentation**: See README.md
- **Examples**: Check example_workflows.md
- **Issues**: GitHub Issues page
- **Community**: Join our Discord

Happy game development! 🎮