# Example Workflows

## 🎯 Common Scenarios

### 1. "I have a game idea but don't know where to start"

```bash
# Step 1: Initialize in Design Mode
python scripts/init_project.py
# Choose: Design Only, Medium timeline
# Include competitor games when prompted

# Step 2: Start with Market Analysis
claude "Read agents/market_analyst.md. Analyze the market for my game idea and provide a Go/No-Go recommendation."

# Step 3: If market looks good, proceed with design
claude "Read agents/master_orchestrator.md and begin the design phase with market insights."

# Result: Market-validated game design with competitive positioning and data-driven recommendations
```

### 2. "I want to make a mobile game in 4 weeks"

```bash
# Step 1: Initialize for mobile development
python scripts/init_project.py
# Choose: Mobile, Casual audience, Development mode, Short timeline

# Step 2: Start development
claude "Read agents/master_orchestrator.md and begin mobile game development. Focus on simple, engaging mechanics."

# The agents will:
# - Week 1: Design and prototype core mechanic
# - Week 2: Implement all features
# - Week 3: Polish and optimize for mobile
# - Week 4: Testing and release preparation
```

### 3. "Test if my game mechanic is fun"

```bash
# Step 1: Quick prototype setup
python scripts/init_project.py  
# Choose: Prototype mode, Rapid timeline

# Step 2: Build the prototype
claude "Read agents/producer_agent_v2.md. I want to test if [describe mechanic] is fun. Create a playable prototype."

# Result: Playable prototype in 2-3 days
```

### 4. "Port my game design to different engines"

```bash
# Step 1: Design mode with multi-engine assessment
python scripts/init_project.py
# Choose: Design Only mode

# Step 2: Analyze for multiple engines
claude "Read agents/master_orchestrator.md. I have a game design. Evaluate implementation for Godot, Unity, and Unreal. Provide timelines and recommendations for each."

# Result: Detailed comparison and recommendations for each engine
```

### 5. "I'm a solo dev - help me make a complete game"

```bash
# Step 1: Full development with AI team
python scripts/init_project.py
# Choose: PC, Core audience, Development mode, Medium timeline

# Step 2: AI team handles all aspects
claude "Read agents/master_orchestrator.md. I'm a solo developer. Activate all agents to help me create a complete indie game. I'll handle the coding, but need help with design, art direction, and QA."

# Agents will provide:
# - Complete design documentation
# - Art style guides and asset lists
# - Implementation specifications
# - Testing plans and QA checklists
# - Milestone management
```

### 6. "I want strict coding standards for my team"

```bash
# Step 1: Initialize with development rules
python scripts/init_project.py
# When prompted for Development Rules, enter:
# - "Follow SOLID principles for all classes"
# - "Use Entity-Component-System architecture"
# - "No functions longer than 30 lines"
# - "All gameplay values must be in JSON configs"
# - "Maintain 60 FPS on GTX 1060 hardware"
# - "Use object pooling for enemies and projectiles"

# Step 2: Producer enforces rules
claude "Read agents/producer_agent.md and project-config.json. Start development and ensure all code follows our development rules strictly."

# Result: All agent-generated code follows your standards
# Producer will reject any code that violates the rules
```

## 💡 Pro Tips

### Working with Design Mode

```markdown
"Read agents/sr_game_designer.md and explore 5 different directions for my puzzle game concept"

"Read agents/sr_game_artist.md and create 3 distinct art styles for my game to choose from"
```

### Managing Development

```markdown
"Read agents/producer_agent_v2.md and give me a daily standup report"

"Read agents/qa_agent.md and create a testing checklist for this week's milestone"
```

### Getting Specific Help

```markdown
"Read agents/game_feel_developer.md and suggest 10 ways to add juice to my jump mechanic"

"Read agents/ui_ux_agent.md and design an intuitive inventory system for mobile"

"Read agents/technical_artist.md and optimize my particle effects for better performance"
```

## 📊 Sample Project Timelines

### Casual Mobile Game (4 weeks)
- **Week 1**: Design & Prototype (Design team + Mechanics Dev)
- **Week 2**: Core Implementation (Full engineering team)
- **Week 3**: Art & Polish (Art team + Game Feel Dev)
- **Week 4**: QA & Release Prep (QA Agent + Producer)

### Indie PC Game (3 months)
- **Month 1**: Pre-production (All design agents)
- **Month 2**: Production (All agents, milestone-based)
- **Month 3**: Polish & Release (Focus on QA and optimization)

### Game Jam Entry (48 hours)
- **Hour 0-4**: Concept & Design (Sr Designer only)
- **Hour 4-24**: Core Implementation (Mechanics Dev)
- **Hour 24-40**: Polish (Game Feel + basic art)
- **Hour 40-48**: Testing & Submission (QA + Producer)

## 🎮 Genre-Specific Workflows

### Platformer
```bash
claude "Read agents/mechanics_developer.md. Design physics-based movement with coyote time, jump buffering, and variable jump height."
```

### RPG
```bash
claude "Read agents/mid_game_designer.md. Create a character progression system with 5 classes, 20 levels, and 50+ skills."
```

### Puzzle
```bash
claude "Read agents/sr_game_designer.md. Design 50 puzzle levels with gradually increasing difficulty and new mechanics every 10 levels."
```

### Strategy
```bash
claude "Read agents/sr_game_designer.md and mid_game_designer.md. Create a resource management system with 4 resources, tech tree, and unit production."
```

## 🔧 Troubleshooting Common Issues

### "Agents seem confused about the project"
```bash
claude "Read projects/[your-game]/project-config.json first, then continue with the current task"
```

### "I want to change direction mid-project"
```bash
claude "Read agents/producer_agent_v2.md. I want to pivot the project. Current: [what it is]. New direction: [what you want]. Create a transition plan."
```

### "Development is taking too long"
```bash
claude "Read agents/producer_agent_v2.md. Analyze current velocity and suggest scope cuts to meet our deadline."
```

## 📈 Metrics and Reporting

### Get Project Status
```bash
claude "Read agents/producer_agent_v2.md and generate a complete status report for week [X]"
```

### Track Progress
```bash
claude "Read the project-config.json and show me percentage complete for each milestone"
```

### Performance Analysis
```bash
claude "Read agents/qa_agent.md and analyze our bug trend over the last 2 weeks"
```

## 📁 Project Management Examples

### Managing Multiple Projects

```bash
# See all your projects
python scripts/project_manager.py status

# Output example:
# 🟢 Space Puzzle Adventure (active, design phase)
# 🔵 Platformer Game (frozen, prototype phase)  
# 🟢 Mobile RPG (active, development phase)
```

### Switching Between Projects

```bash
# Work on different projects
python scripts/project_manager.py resume space-puzzle-adventure
python scripts/project_manager.py resume mobile-rpg

# Each resume provides specific next steps for that project
```

### Project Lifecycle Management

```bash
# Start a new project
python scripts/init_project.py

# Work on it for a while...
claude "Read agents/master_orchestrator.md and continue my project"

# Need to pause? Freeze it
python scripts/project_manager.py freeze my-game

# Later, resume where you left off
python scripts/project_manager.py resume my-game

# Not working out? Start over with lessons learned
python scripts/project_manager.py startover my-game
```

### Interactive Project Management

```bash
# Use the interactive menu for easy management
python scripts/project_manager.py menu

# Navigate with simple number choices:
# 1. Show all projects status
# 2. Create new project  
# 3. Resume project
# 4. Freeze project
# 5. Start over project
```

### Working with Project Status

```bash
# Get detailed status of specific project
python scripts/project_manager.py status my-platformer

# Shows:
# - Current phase and mode
# - Active agents
# - Current milestone
# - Creation and modification dates
# - Next recommended actions
```

## 🔄 Project Recovery Examples

### Handling Interrupted Work

```bash
# Your computer crashed mid-development?
python scripts/project_manager.py status
# Shows exactly where you were

python scripts/project_manager.py resume my-interrupted-project
# Provides specific Claude commands to continue
```

### Starting Over Smartly

```bash
# Project not going well? Start over but keep lessons
python scripts/project_manager.py startover problematic-game

# This:
# - Creates backup of current state
# - Resets to Market Analysis phase
# - Keeps project structure
# - Provides fresh start commands
```

### Multi-Project Development

```bash
# Game jam: quick prototype
python scripts/init_project.py  # Choose: Prototype, Rapid

# Main project: full development  
python scripts/init_project.py  # Choose: Development, Medium

# Side project: design exploration
python scripts/init_project.py  # Choose: Design, Short

# Switch between them as needed
python scripts/project_manager.py resume game-jam-entry
python scripts/project_manager.py resume main-project
```

Remember: The agents work best when given clear, specific requests with proper context!