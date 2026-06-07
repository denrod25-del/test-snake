# Development Rules Guide

## Overview

The Game Studio Sub-Agents system allows you to define custom development rules that all agents must follow. These rules are stored in your `project-config.json` and enforced by the Producer Agent.

## Setting Development Rules

During project initialization (`python scripts/init_project.py`), you'll be prompted:

```
11. DEVELOPMENT RULES & GUIDELINES:
    Define coding standards and practices for your project.
    These rules will be enforced by all development agents.
```

Enter your rules one per line. Press Enter on an empty line to finish.

## Example Rules by Category

### Architecture Patterns
- "Use SOLID principles for all game systems"
- "Follow MVC pattern for UI code"
- "Implement Entity-Component-System for gameplay"
- "Use State Machine pattern for AI"
- "Apply Observer pattern for events"

### Code Quality
- "Keep functions under 30 lines"
- "Classes should not exceed 200 lines"
- "Use meaningful variable and function names"
- "Write self-documenting code"
- "DRY - Don't Repeat Yourself"

### Performance
- "Maintain 60 FPS on mid-range hardware"
- "Memory usage must stay under 2GB"
- "Use object pooling for frequently spawned objects"
- "Implement LOD for distant objects"
- "Profile before optimizing"

### Project-Specific
- "No namespaces - use flat structure"
- "Prefix all UI classes with 'UI'"
- "All damage calculations through DamageSystem"
- "Data-driven design for all gameplay values"
- "Use async/await for loading operations"

### Testing & Documentation
- "Unit tests required for core mechanics"
- "Integration tests for all systems"
- "Code comments for complex algorithms"
- "Update documentation with code changes"

## How Rules Are Enforced

1. **Storage**: Rules are saved in `project-config.json` under `development_rules`
2. **Loading**: Producer Agent reads rules from the config
3. **Communication**: Producer includes rules in every task assignment
4. **Validation**: Code reviews check against all rules
5. **Enforcement**: Non-compliant code is rejected

## Viewing Your Rules

```bash
# View all project configuration including rules
cat projects/[your-game]/project-config.json

# View just the rules
cat projects/[your-game]/project-config.json | grep -A 20 "development_rules"
```

## Updating Rules

To modify rules after project creation:
1. Edit `project-config.json` directly
2. Update the `development_rules` array
3. Inform the Producer: "The development rules have been updated in project-config.json"

## Best Practices

1. **Be Specific**: "Functions under 30 lines" not "Keep functions small"
2. **Be Measurable**: "60 FPS minimum" not "Good performance"
3. **Be Realistic**: Don't set impossible standards
4. **Start Simple**: Add rules as needed, don't over-constrain initially
5. **Document Why**: Include rationale for unusual rules

## Example project-config.json with Rules

```json
{
  "project": {
    "name": "Space Defender",
    "engine": "Unity",
    "platform": "PC",
    "genre": "Action",
    "audience": "Core",
    "timeline": "Short",
    "mode": "development",
    "version": "0.0.1"
  },
  "development_rules": [
    "Use SOLID principles for all game systems",
    "No namespaces - keep everything in global scope",
    "Implement object pooling for all projectiles",
    "Maintain 60 FPS on GTX 1060 or better",
    "All gameplay values in JSON configuration files",
    "Maximum 30 lines per function",
    "Unit tests for all core mechanics"
  ],
  "team": {
    "active_agents": ["producer_agent", "sr_game_designer", "mechanics_developer"],
    "lead_agent": "producer_agent"
  },
  "milestones": [
    {
      "name": "Alpha",
      "target_date": "2024-02-01",
      "deliverables": ["Core mechanics", "Basic UI"],
      "success_criteria": ["Playable", "Rules compliant"]
    }
  ]
}
```

## Compliance Workflow

1. **Agent receives task** → Reads rules from config
2. **Agent writes code** → Follows all rules
3. **Producer reviews** → Checks against rules
4. **If compliant** → Code approved
5. **If violation** → Code rejected, must fix

## Common Issues

**Q: What if a rule conflicts with engine best practices?**
A: The Producer will flag this and ask for clarification.

**Q: Can rules be waived for specific cases?**
A: Yes, but requires Producer approval and documentation.

**Q: How strict is enforcement?**
A: Very strict - violations result in code rejection.

**Q: Can I add rules mid-project?**
A: Yes, edit project-config.json and notify the team.

## Rule Templates for Different Genres

### Action Games
```
"Maintain 60 FPS minimum at all times"
"Use object pooling for all projectiles and particles"
"Implement hit-stop for impact feedback"
"All combat values must be tweakable at runtime"
```

### Strategy Games
```
"Use Command pattern for all player actions"
"Implement fog of war with efficient culling"
"All unit stats in external data files"
"Pathfinding must handle 100+ units smoothly"
```

### Mobile Games
```
"Target 30 FPS on devices from 2020"
"Memory usage under 1GB"
"All UI must be touch-optimized"
"Implement battery-saving mode"
```

### Multiplayer Games
```
"All gameplay logic must be server-authoritative"
"Use client-side prediction for movement"
"Implement lag compensation"
"Network messages must be under 1KB"
```

## Integration with Agents

### Producer Agent
- Loads rules from config at project start
- Includes rules in every task assignment
- Validates all deliverables against rules
- Reports violations to Master Orchestrator

### Development Agents
- Read rules from project-config.json
- Apply rules to all generated code
- Document any necessary exceptions
- Request clarification when rules conflict

### QA Agent
- Creates test cases for each rule
- Validates code compliance
- Reports violations in bug tracking
- Suggests rule improvements based on issues

## Monitoring Compliance

The Producer Agent tracks:
- Total rules defined
- Compliance rate per agent
- Common violations
- Exception requests
- Rule effectiveness

Regular reports show:
```
RULES COMPLIANCE REPORT
=======================
Week: 5
Total Rules: 8
Compliance Rate: 92%

Top Violations:
1. "Functions under 30 lines" - 3 violations
2. "Object pooling" - 1 violation

Agents Performance:
- Mechanics Developer: 95% compliant
- UI/UX Agent: 88% compliant
- Game Feel Developer: 94% compliant
```

## Evolution of Rules

Rules should evolve with your project:

### Early Development
Focus on architecture and standards:
- "Use agreed design patterns"
- "Follow naming conventions"
- "Document public APIs"

### Mid Development
Add performance and quality rules:
- "Maintain target framerate"
- "Memory budgets per system"
- "Code coverage requirements"

### Polish Phase
Include polish and ship requirements:
- "No compiler warnings"
- "All strings localized"
- "Accessibility features required"

### Post-Launch
Maintenance and update rules:
- "Backward compatibility required"
- "Telemetry for new features"
- "A/B testing framework usage"