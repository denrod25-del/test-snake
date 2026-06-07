#!/usr/bin/env python3
"""
Agent Customizer - Creates project-specific agents
Customizes agents based on engine choice and project requirements

Author: Tuna Pamir (https://github.com/pamirtuna)
Project: Game Studio Sub-Agents
License: MIT
"""

import json
import shutil
from pathlib import Path
from typing import Dict, Any


class AgentCustomizer:
    def __init__(self):
        self.base_agents_path = Path("agents")
        self.engine_configs_path = Path("engine_configs")
        
    def customize_agents_for_project(self, project_path: Path, project_config: Dict[str, Any]):
        """Create customized agents for a specific project"""
        engine = project_config.get('project', {}).get('engine', 'Godot')
        engine_version = project_config.get('project', {}).get('engine_version', 'latest')
        platform = project_config.get('project', {}).get('platform', 'PC')
        genre = project_config.get('project', {}).get('genre', 'Action')
        
        # Create agents folder in project
        project_agents_path = project_path / "agents"
        project_agents_path.mkdir(exist_ok=True)
        
        # Load engine configuration and add version
        engine_config = self.load_engine_config(engine)
        engine_config['version'] = engine_version  # Add the actual version from project
        
        # Get active agents from project config
        active_agents = project_config.get('team', {}).get('active_agents', [])
        
        print(f"Customizing {len(active_agents)} agents for {engine} v{engine_version} development...")
        
        for agent_name in active_agents:
            self.customize_agent(agent_name, project_agents_path, engine_config, project_config)
        
        # Create project-specific orchestrator
        self.create_project_orchestrator(project_agents_path, project_config, engine_config)
        
        print(f"Project agents created in: {project_agents_path}")
        
    def load_engine_config(self, engine: str) -> Dict[str, Any]:
        """Load engine-specific configuration"""
        # Handle engine name mapping
        engine_map = {
            "Unreal Engine": "unreal",
            "Unity": "unity", 
            "Godot": "godot"
        }
        engine_filename = engine_map.get(engine, engine.lower().replace(" ", ""))
        config_file = self.engine_configs_path / f"{engine_filename}_config.json"
        
        if config_file.exists():
            with open(config_file, 'r') as f:
                return json.load(f)
        else:
            print(f"Warning: No config found for {engine}, using defaults")
            return {"engine": engine, "best_practices": {}, "agent_specializations": {}}
    
    def customize_agent(self, agent_name: str, project_agents_path: Path, 
                       engine_config: Dict[str, Any], project_config: Dict[str, Any]):
        """Customize a single agent for the project"""
        base_agent_file = self.base_agents_path / f"{agent_name}.md"
        project_agent_file = project_agents_path / f"{agent_name}.md"
        
        if not base_agent_file.exists():
            print(f"Warning: Base agent {agent_name} not found")
            return
        
        # Read base agent
        with open(base_agent_file, 'r', encoding='utf-8') as f:
            agent_content = f.read()
        
        # Customize based on engine and project
        customized_content = self.apply_customizations(
            agent_content, agent_name, engine_config, project_config
        )
        
        # Write customized agent
        with open(project_agent_file, 'w', encoding='utf-8') as f:
            f.write(customized_content)
    
    def apply_customizations(self, content: str, agent_name: str, 
                           engine_config: Dict[str, Any], project_config: Dict[str, Any]) -> str:
        """Apply engine and project specific customizations to agent content"""
        engine = engine_config.get('engine', 'Godot')
        engine_version = project_config.get('project', {}).get('engine_version', engine_config.get('version', 'latest'))
        platform = project_config.get('project', {}).get('platform', 'PC')
        genre = project_config.get('project', {}).get('genre', 'Action')
        project_name = project_config.get('project', {}).get('name', 'Game Project')
        
        # Add project header with version
        project_header = f"""# {agent_name.replace('_', ' ').title()} - {project_name}

## Project Configuration
- **Engine**: {engine} v{engine_version}
- **Platform**: {platform}
- **Genre**: {genre}
- **Project**: {project_name}

---

"""
        
        # Engine-specific customizations
        engine_section = self.create_engine_section(agent_name, engine_config, platform)
        
        # Insert customizations
        if "## Core Responsibilities" in content:
            content = content.replace(
                "## Core Responsibilities",
                f"{project_header}## Engine-Specific Guidelines\n{engine_section}\n\n## Core Responsibilities"
            )
        else:
            content = f"{project_header}{engine_section}\n\n{content}"
        
        # Apply agent-specific customizations
        if agent_name == "mechanics_developer":
            content = self.customize_mechanics_developer(content, engine_config)
        elif agent_name == "game_feel_developer":
            content = self.customize_game_feel_developer(content, engine_config)
        elif agent_name == "technical_artist":
            content = self.customize_technical_artist(content, engine_config)
        elif agent_name == "ui_ux_agent":
            content = self.customize_ui_ux_agent(content, engine_config)
        elif agent_name == "sr_game_artist":
            content = self.customize_sr_game_artist(content, engine_config, project_config)
        elif agent_name == "qa_agent":
            content = self.customize_qa_agent(content, engine_config, project_config)
        
        return content
    
    def create_engine_section(self, agent_name: str, engine_config: Dict[str, Any], platform: str) -> str:
        """Create engine-specific guidelines section"""
        engine = engine_config.get('engine', 'Godot')
        engine_version = engine_config.get('version', 'Latest')
        
        section = f"""### {engine} Best Practices

**Engine Version**: {engine_version}
**Target Platform**: {platform}

"""
        
        # Add agent-specific engine guidelines
        specializations = engine_config.get('agent_specializations', {}).get(agent_name, {})
        
        if specializations:
            section += f"""**Your {engine} Focus Areas:**
"""
            for area in specializations.get('focus', []):
                section += f"- {area}\n"
            
            section += f"""
**Recommended Tools:**
"""
            for tool in specializations.get('tools', []):
                section += f"- {tool}\n"
        
        # Add naming conventions
        naming = engine_config.get('best_practices', {}).get('naming_conventions', {})
        if naming:
            section += f"""
**{engine} Naming Conventions:**
"""
            for item, convention in naming.items():
                section += f"- {item.title()}: {convention}\n"
        
        return section
    
    def customize_mechanics_developer(self, content: str, engine_config: Dict[str, Any]) -> str:
        """Add mechanics developer specific customizations"""
        engine = engine_config.get('engine', 'Godot')
        
        engine_specific = f"""
## {engine}-Specific Implementation

### Core Mechanics Implementation
"""
        
        if engine == "Godot":
            engine_specific += """
- Use **Nodes and Scenes** for game object hierarchy
- Implement mechanics with **GDScript** for rapid iteration
- Use **Signals** for event-driven programming
- Leverage **Built-in Physics** (RigidBody, CharacterBody)
- Create **Custom Resources** for data management
- Use **Autoload** for global systems and managers

### Godot-Specific Patterns
```gdscript
# Example: Player Controller
extends CharacterBody3D
class_name PlayerController

@export var speed: float = 5.0
@export var jump_velocity: float = 8.0

signal health_changed(new_health: int)

func _physics_process(delta):
    handle_movement(delta)
    handle_jump()
    move_and_slide()
```
"""
        elif engine == "Unity":
            engine_specific += """
- Use **Component-based architecture** with MonoBehaviour
- Implement with **C# scripting** for performance
- Use **Events and UnityActions** for decoupling
- Leverage **Physics Components** (Rigidbody, Collider)
- Create **ScriptableObjects** for data assets
- Use **Singleton pattern** sparingly, prefer dependency injection

### Unity-Specific Patterns
```csharp
// Example: Player Controller
public class PlayerController : MonoBehaviour
{
    [SerializeField] private float speed = 5f;
    [SerializeField] private float jumpForce = 8f;
    
    public event System.Action<int> OnHealthChanged;
    
    private Rigidbody rb;
    
    void Start()
    {
        rb = GetComponent<Rigidbody>();
    }
    
    void Update()
    {
        HandleMovement();
        HandleJump();
    }
}
```
"""
        elif engine == "Unreal Engine":
            engine_specific += """
- Use **Blueprint and C++** hybrid approach
- Implement with **Unreal's Gameplay Framework**
- Use **Delegates** for event communication
- Leverage **Component system** (ActorComponents)
- Create **Data Assets** for configuration
- Use **Gameplay Ability System** for complex mechanics

### Unreal-Specific Patterns
```cpp
// Example: Player Controller Header
UCLASS()
class GAME_API APlayerController : public ACharacter
{
    GENERATED_BODY()
    
public:
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float Speed = 5.0f;
    
    UFUNCTION(BlueprintCallable)
    void HandleMovement();
    
    DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnHealthChanged, int32, NewHealth);
    UPROPERTY(BlueprintAssignable)
    FOnHealthChanged OnHealthChanged;
};
```
"""
        
        # Insert before the first major section
        if "## Core Responsibilities" in content:
            content = content.replace("## Core Responsibilities", f"{engine_specific}\n## Core Responsibilities")
        
        return content
    
    def customize_game_feel_developer(self, content: str, engine_config: Dict[str, Any]) -> str:
        """Add game feel developer specific customizations"""
        engine = engine_config.get('engine', 'Godot')
        
        engine_specific = f"""
## {engine} Game Feel Toolkit

### Polish and Juice Implementation
"""
        
        if engine == "Godot":
            engine_specific += """
- Use **Tween nodes** for smooth animations and transitions
- Create **Particle Systems** with GPUParticles2D/3D
- Implement **Custom Shaders** for visual effects
- Use **AudioStreamPlayer** nodes for dynamic audio
- Leverage **AnimationPlayer** for complex sequences
- Create **Callable** functions for responsive feedback

### Godot Juice Examples
```gdscript
# Screen shake using Tween
func screen_shake(duration: float, strength: float):
    var tween = create_tween()
    var camera = get_viewport().get_camera_3d()
    
    for i in range(10):
        var offset = Vector3(
            randf_range(-strength, strength),
            randf_range(-strength, strength),
            0
        )
        tween.tween_property(camera, "position", camera.position + offset, duration/10)
    
    tween.tween_property(camera, "position", camera.position, duration/10)
```
"""
        elif engine == "Unity":
            engine_specific += """
- Use **DOTween** or Animation system for smooth transitions
- Create **Particle Systems** with Visual Effect Graph
- Implement **Post-processing effects** for visual polish
- Use **Audio Mixer** for dynamic audio processing
- Leverage **Cinemachine** for camera effects
- Create **Coroutines** for timed effects

### Unity Juice Examples
```csharp
// Screen shake using DOTween
public void ScreenShake(float duration, float strength)
{
    Camera.main.transform.DOShakePosition(duration, strength, 10, 90, false, true)
        .SetEase(Ease.OutQuad);
}

// Hit effect with particles and sound
public void PlayHitEffect(Vector3 position)
{
    ParticleSystem.PlayAt(position);
    AudioSource.PlayOneShot(hitSound);
    
    // Brief time slow
    StartCoroutine(TimeSlowEffect(0.1f, 0.5f));
}
```
"""
        elif engine == "Unreal Engine":
            engine_specific += """
- Use **Animation Blueprints** for character animations
- Create **Niagara Systems** for particle effects
- Implement **Post-process volumes** for visual effects
- Use **Audio Components** and **MetaSounds** for audio
- Leverage **Sequencer** for cinematic effects
- Create **Blueprint functions** for reusable effects

### Unreal Juice Examples
```cpp
// Camera shake in C++
void AGameFeelController::TriggerCameraShake(float Intensity, float Duration)
{
    if (CameraShakeClass)
    {
        GetWorld()->GetFirstPlayerController()->ClientStartCameraShake(
            CameraShakeClass, Intensity, ECameraShakePlaySpace::World
        );
    }
}
```
"""
        
        if "## Core Responsibilities" in content:
            content = content.replace("## Core Responsibilities", f"{engine_specific}\n## Core Responsibilities")
        
        return content
    
    def customize_technical_artist(self, content: str, engine_config: Dict[str, Any]) -> str:
        """Add technical artist specific customizations"""
        engine = engine_config.get('engine', 'Godot')
        
        engine_specific = f"""
## {engine} Technical Art Pipeline

### Shader and VFX Development
"""
        
        if engine == "Godot":
            engine_specific += """
- Create **Custom Shaders** using Godot's shader language
- Use **Godot's Material system** for efficient rendering
- Implement **Custom Resources** for shader parameters
- Optimize using **Texture arrays** and **MultiMesh**
- Use **RenderingServer** for advanced techniques
- Create **Tool scripts** for artist workflows

### Godot Shader Example
```glsl
shader_type canvas_item;

uniform float dissolve_amount : hint_range(0.0, 1.0) = 0.0;
uniform texture2D dissolve_texture : hint_default_white;
uniform vec4 edge_color : source_color = vec4(1.0, 0.5, 0.0, 1.0);

void fragment() {
    vec4 tex_color = texture(TEXTURE, UV);
    float dissolve = texture(dissolve_texture, UV).r;
    
    if (dissolve < dissolve_amount) {
        discard;
    }
    
    float edge = step(dissolve_amount, dissolve) * 
                 step(dissolve, dissolve_amount + 0.1);
    
    COLOR = mix(tex_color, edge_color, edge);
}
```
"""
        elif engine == "Unity":
            engine_specific += """
- Create **Shader Graph** nodes for visual shader development
- Use **Visual Effect Graph** for complex particle systems
- Implement **Custom Render Features** in URP/HDRP
- Optimize using **GPU Instancing** and **SRP Batcher**
- Use **Compute Shaders** for complex calculations
- Create **Editor Tools** for artist workflows

### Unity Shader Graph Workflow
- Use **Master Stack** for different render pipelines
- Create **Custom Function** nodes for reusable code
- Use **Property** nodes for exposed parameters
- Implement **Keywords** for shader variants
- Optimize with **Static branching** when possible
"""
        elif engine == "Unreal Engine":
            engine_specific += """
- Create **Material Blueprints** with visual node editor
- Use **Niagara Editor** for advanced particle systems
- Implement **Custom HLSL** nodes when needed
- Optimize using **Material Instances** and **Parameters**
- Use **Material Functions** for reusable logic
- Create **Blueprint Tools** for artist workflows

### Unreal Material Best Practices
- Use **Material Instances** instead of copying materials
- Implement **Material Parameter Collections** for global changes
- Use **Material Functions** for commonly used node groups
- Optimize with **Static Switch Parameters** for variants
- Profile with **Shader Complexity** view mode
"""
        
        if "## Core Responsibilities" in content:
            content = content.replace("## Core Responsibilities", f"{engine_specific}\n## Core Responsibilities")
        
        return content
    
    def customize_ui_ux_agent(self, content: str, engine_config: Dict[str, Any]) -> str:
        """Add UI/UX agent specific customizations"""
        engine = engine_config.get('engine', 'Godot')
        
        engine_specific = f"""
## {engine} UI Development

### User Interface Implementation
"""
        
        if engine == "Godot":
            engine_specific += """
- Use **Control nodes** for UI layout and interaction
- Implement **Responsive design** with anchors and containers
- Create **Custom Themes** for consistent styling
- Use **Signals** for UI event handling
- Leverage **Tween** for UI animations
- Create **Custom Controls** for specialized UI elements

### Godot UI Best Practices
```gdscript
# Responsive button that adapts to content
extends Button
class_name ResponsiveButton

func _ready():
    # Connect signals
    pressed.connect(_on_button_pressed)
    mouse_entered.connect(_on_mouse_entered)
    mouse_exited.connect(_on_mouse_exited)
    
    # Auto-resize based on text
    custom_minimum_size = get_theme_font("font").get_string_size(text)

func _on_button_pressed():
    # Add juice with tween
    var tween = create_tween()
    tween.tween_property(self, "scale", Vector2(0.95, 0.95), 0.1)
    tween.tween_property(self, "scale", Vector2.ONE, 0.1)
```
"""
        elif engine == "Unity":
            engine_specific += """
- Use **UGUI Canvas** system with proper render modes
- Implement **Responsive layouts** with Layout Groups
- Create **UI Prefabs** for reusable components
- Use **Event System** for input handling
- Leverage **DOTween** for smooth UI animations
- Create **Custom UI Components** with inheritance

### Unity UI Best Practices
```csharp
// Responsive UI panel that adapts to screen size
public class ResponsivePanel : MonoBehaviour
{
    [SerializeField] private RectTransform panelRect;
    [SerializeField] private Vector2 mobileSize = new Vector2(300, 400);
    [SerializeField] private Vector2 desktopSize = new Vector2(500, 600);
    
    void Start()
    {
        AdaptToScreenSize();
    }
    
    void AdaptToScreenSize()
    {
        bool isMobile = Screen.width < 800;
        Vector2 targetSize = isMobile ? mobileSize : desktopSize;
        panelRect.sizeDelta = targetSize;
    }
}
```
"""
        elif engine == "Unreal Engine":
            engine_specific += """
- Use **UMG Widget Blueprints** for UI creation
- Implement **Responsive design** with anchors and size boxes
- Create **Widget Styles** for consistent theming
- Use **Input bindings** and **Enhanced Input** for interaction
- Leverage **Animation tracks** for UI transitions
- Create **Custom Widget classes** in C++

### Unreal UMG Best Practices
- Use **Panel widgets** (Canvas, Horizontal/Vertical Box) for layout
- Implement **Data Binding** for dynamic content
- Create **Widget Component** for 3D UI elements
- Use **Slate** for complex custom widgets
- Optimize with **Widget pooling** for lists
"""
        
        if "## Core Responsibilities" in content:
            content = content.replace("## Core Responsibilities", f"{engine_specific}\n## Core Responsibilities")
        
        return content
    
    def customize_sr_game_artist(self, content: str, engine_config: Dict[str, Any], project_config: Dict[str, Any]) -> str:
        """Add senior game artist specific customizations"""
        engine = engine_config.get('engine', 'Godot')
        platform = project_config.get('project', {}).get('platform', 'PC')
        
        engine_specific = f"""
## {engine} Art Pipeline for {platform}

### Art Asset Creation and Management
"""
        
        platform_specific = ""
        if platform == "Mobile":
            platform_specific = """
**Mobile Optimization Requirements:**
- Texture sizes: Max 1024x1024 for main textures
- Use texture compression (ASTC for Android, PVRTC for iOS)
- Limit draw calls: <100 for good performance
- Polygon count: <10k triangles per character
- Use texture atlasing to reduce draw calls
"""
        elif platform == "PC":
            platform_specific = """
**PC Development Specifications:**
- Texture sizes: Up to 4K (4096x4096) for hero assets
- Support multiple quality levels
- Target 60 FPS at 1080p
- Use LOD systems for optimization
- Support multiple input methods
"""
        elif platform == "Console":
            platform_specific = """
**Console Development Requirements:**
- Platform-specific texture formats
- HDR support and wide color gamut
- 4K textures for next-gen consoles
- Platform certification requirements
- Controller-specific UI considerations
"""
        
        engine_specific += platform_specific
        
        if engine == "Godot":
            engine_specific += """
### Godot Art Integration
- Use **Godot's Import System** for optimal asset processing
- Create **Custom Import Plugins** for specialized workflows
- Use **Resource format** (.tres) for material assets
- Implement **Texture Arrays** for optimized rendering
- Create **3D Scenes** (.tscn) for complete art assets
- Use **Godot's built-in shader editor** for material creation
"""
        elif engine == "Unity":
            engine_specific += """
### Unity Art Integration
- Use **Unity Asset Pipeline** with proper import settings
- Create **Material Presets** for consistent look
- Use **Prefab System** for art asset organization
- Implement **Texture Streaming** for large projects
- Create **Asset Bundles** for modular content
- Use **Addressable Assets** for efficient loading
"""
        elif engine == "Unreal Engine":
            engine_specific += """
### Unreal Art Integration
- Use **Unreal Import Pipeline** with FBX workflow
- Create **Material Instances** for art variants
- Use **World Partition** for large environments
- Implement **Nanite** for high-detail geometry
- Create **Data Assets** for art configuration
- Use **Lumen** for dynamic global illumination
"""
        
        if "## Core Responsibilities" in content:
            content = content.replace("## Core Responsibilities", f"{engine_specific}\n## Core Responsibilities")
        
        return content
    
    def customize_qa_agent(self, content: str, engine_config: Dict[str, Any], project_config: Dict[str, Any]) -> str:
        """Add QA agent specific customizations"""
        engine = engine_config.get('engine', 'Godot')
        platform = project_config.get('project', {}).get('platform', 'PC')
        
        engine_specific = f"""
## {engine} Testing Framework for {platform}

### Engine-Specific Testing Tools
"""
        
        if engine == "Godot":
            engine_specific += """
- Use **GUT (Godot Unit Test)** for automated testing
- Leverage **Godot's built-in profiler** for performance testing
- Use **Remote debugger** for device testing
- Create **Test Scenes** for specific feature testing
- Use **Export templates** for platform-specific testing
- Implement **Custom test scripts** with GDScript

### Godot Testing Example
```gdscript
# Example test script using GUT
extends GutTest

func before_each():
    # Setup before each test
    gut.p("Setting up test environment")

func test_player_movement():
    var player = preload("res://Player.tscn").instantiate()
    add_child_autofree(player)
    
    # Test movement
    player.move_direction = Vector3.FORWARD
    player._physics_process(0.016)  # Simulate one frame
    
    assert_gt(player.velocity.z, 0, "Player should move forward")
```
"""
        elif engine == "Unity":
            engine_specific += """
- Use **Unity Test Framework** (UTF) for automated testing
- Leverage **Unity Profiler** for performance analysis
- Use **Device Simulator** for mobile testing
- Create **Test Assemblies** for organized testing
- Use **Cloud Build** for automated testing across platforms
- Implement **Custom Attributes** for test categorization

### Unity Testing Example
```csharp
// Example test using Unity Test Framework
[TestFixture]
public class PlayerMovementTests
{
    private GameObject playerGO;
    private PlayerController player;
    
    [SetUp]
    public void Setup()
    {
        playerGO = new GameObject();
        player = playerGO.AddComponent<PlayerController>();
    }
    
    [Test]
    public void Player_Should_Move_Forward_When_Input_Provided()
    {
        // Arrange
        Vector3 initialPosition = player.transform.position;
        
        // Act
        player.HandleMovement(Vector3.forward);
        
        // Assert
        Assert.Greater(player.transform.position.z, initialPosition.z);
    }
    
    [TearDown]
    public void Teardown()
    {
        Object.DestroyImmediate(playerGO);
    }
}
```
"""
        elif engine == "Unreal Engine":
            engine_specific += """
- Use **Unreal's Automation Framework** for testing
- Leverage **Stat Commands** for performance profiling
- Use **Frontend Automation** for UI testing
- Create **Functional Tests** with Blueprint or C++
- Use **Gauntlet** for large-scale testing
- Implement **Custom Test Classes** for specialized testing

### Unreal Testing Example
```cpp
// Example functional test in C++
UCLASS()
class GAME_API APlayerMovementTest : public AFunctionalTest
{
    GENERATED_BODY()
    
public:
    APlayerMovementTest();
    
protected:
    virtual void StartTest() override;
    
    UFUNCTION()
    void TestPlayerMovement();
    
    UPROPERTY(EditAnywhere)
    TSubclassOf<APawn> PlayerClass;
};
```
"""
        
        # Platform-specific testing considerations
        platform_testing = ""
        if platform == "Mobile":
            platform_testing = """
### Mobile-Specific Testing
- **Performance Testing**: Frame rate on various devices
- **Battery Testing**: Power consumption over time
- **Touch Testing**: Multi-touch and gesture recognition
- **Device Testing**: Various screen sizes and resolutions
- **Network Testing**: Poor connectivity scenarios
- **Store Testing**: Platform store submission requirements
"""
        elif platform == "PC":
            platform_testing = """
### PC-Specific Testing
- **Hardware Compatibility**: Various GPU/CPU combinations
- **Input Testing**: Keyboard, mouse, and controller support
- **Resolution Testing**: Multiple monitor setups and resolutions
- **Performance Scaling**: Graphics settings impact
- **Accessibility Testing**: Screen readers and colorblind support
- **Platform Testing**: Windows, Mac, and Linux compatibility
"""
        
        engine_specific += platform_testing
        
        if "## Core Responsibilities" in content:
            content = content.replace("## Core Responsibilities", f"{engine_specific}\n## Core Responsibilities")
        
        return content
    
    def create_project_orchestrator(self, project_agents_path: Path, project_config: Dict[str, Any], engine_config: Dict[str, Any]):
        """Create a project-specific orchestrator"""
        project_name = project_config.get('project', {}).get('name', 'Game Project')
        engine = engine_config.get('engine', 'Godot')
        engine_version = project_config.get('project', {}).get('engine_version', engine_config.get('version', 'latest'))
        platform = project_config.get('project', {}).get('platform', 'PC')
        
        orchestrator_content = f"""# Project Orchestrator - {project_name}

## Project-Specific Configuration
- **Engine**: {engine} v{engine_version}
- **Platform**: {platform}
- **Project**: {project_name}

## Agent Team for This Project
{self.generate_agent_list(project_config)}

## Project-Specific Workflow

### Current Phase
**Phase**: {project_config.get('project', {}).get('phase', 'Market Analysis')}

### Next Steps
{self.generate_next_steps(project_config, engine)}

## Engine-Specific Commands

### {engine} Development Commands
{self.generate_engine_commands(engine)}

## Project File Locations
- **Project Config**: `project-config.json`
- **Agents**: `agents/` (project-specific)
- **Documentation**: `documentation/`
- **Source**: `source/`

## Quick Actions

### Resume Development
```bash
# Navigate to project
cd projects/{project_config.get('project', {}).get('name', 'project').lower().replace(' ', '-')}

# Activate current phase agents
claude "Read agents/producer_agent.md and continue development"
```

### Check Project Status
```bash
claude "Read project-config.json and provide current status"
```

### Switch Development Phase
```bash
claude "Read agents/producer_agent.md and transition to [next-phase]"
```

## Troubleshooting

### Common Issues
- **Agent Conflicts**: Use project-specific agents in `agents/` folder
- **Engine Issues**: Check `{engine.lower()}_config.json` for best practices
- **Platform Issues**: Review platform-specific requirements

### Getting Help
1. Check project-specific agent documentation
2. Review engine configuration files
3. Consult project status in `project-config.json`
4. Use producer agent for coordination
"""
        
        with open(project_agents_path / "project_orchestrator.md", 'w', encoding='utf-8') as f:
            f.write(orchestrator_content)
    
    def generate_agent_list(self, project_config: Dict[str, Any]) -> str:
        """Generate formatted list of active agents"""
        active_agents = project_config.get('team', {}).get('active_agents', [])
        
        agent_list = ""
        for agent in active_agents:
            agent_display = agent.replace('_', ' ').title()
            agent_list += f"- **{agent_display}** (`agents/{agent}.md`)\n"
        
        return agent_list
    
    def generate_next_steps(self, project_config: Dict[str, Any], engine: str) -> str:
        """Generate next steps based on current phase"""
        phase = project_config.get('project', {}).get('phase', 'Market Analysis')
        
        if phase == "Market Analysis":
            return f"""1. Run market analysis with Market Analyst
2. Validate market opportunity
3. Proceed to design phase if approved
4. Set up {engine} project structure"""
        elif phase == "Design":
            return f"""1. Create game design documentation
2. Establish art direction
3. Plan {engine}-specific implementation
4. Validate technical feasibility"""
        elif phase == "Development":
            return f"""1. Set up {engine} project
2. Implement core mechanics
3. Create art assets
4. Integrate and test features"""
        else:
            return "Continue with current phase objectives"
    
    def generate_engine_commands(self, engine: str) -> str:
        """Generate engine-specific development commands"""
        if engine == "Godot":
            return """```bash
# Create new Godot project
godot --editor --path ./source

# Run project
godot --path ./source

# Export for platform
godot --export "Platform" ./builds/game.exe --path ./source
```"""
        elif engine == "Unity":
            return """```bash
# Open Unity project
unity -projectPath ./source

# Build project (requires Unity installed)
unity -batchmode -quit -projectPath ./source -buildTarget StandaloneWindows64

# Run tests
unity -batchmode -runTests -projectPath ./source
```"""
        elif engine == "Unreal Engine":
            return """```bash
# Generate project files
UnrealBuildTool -projectfiles -project="./source/Project.uproject"

# Build project
UnrealBuildTool Development Win64 -project="./source/Project.uproject"

# Package for distribution
RunUAT BuildCookRun -project="./source/Project.uproject" -platform=Win64
```"""
        else:
            return "# Engine-specific commands will be added here"


if __name__ == "__main__":
    customizer = AgentCustomizer()
    print("Agent Customizer - Creates project-specific agents")
    print("This script is called automatically by the project initialization system.")