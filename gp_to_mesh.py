import bpy

def get_colors(gp):
    active_material = gp.active_material
    gp_style = active_material.grease_pencil  # Grease Pencil material settings

    stroke_color = gp_style.color
    fill_color   = gp_style.fill_color
    return (stroke_color, fill_color)

def gp_to_mesh(gp = None, keep_original=True):
    # Assume active object is a Grease Pencil
    if gp is None:
        gp = bpy.context.active_object

    print("Active:", gp.type)
    if gp is None or gp.type not in {'GPENCIL', 'GREASEPENCIL'}:
        raise RuntimeError(f"Active must be Grease Pencil, got {gp.type}")

    (_, fill_color) = get_colors(gp)
    print(f"Color:{fill_color}")

    orig_gp = gp
    # Duplicate if you want to keep the original GP
    if keep_original:
        gp = gp.copy()
        gp.data = gp.data.copy()
        
        # Get or create "objMesh" collection
        obj_mesh_collection = bpy.data.collections.get("objMesh")
        if obj_mesh_collection is None:
            obj_mesh_collection = bpy.data.collections.new("objMesh")
            bpy.context.scene.collection.children.link(obj_mesh_collection)
        
        obj_mesh_collection.objects.link(gp)
        bpy.context.view_layer.objects.active = gp
        orig_gp.hide_set(True)

    # Convert Grease Pencil to Mesh before using mesh operators
    bpy.context.view_layer.objects.active = gp
    gp.select_set(True)
    bpy.ops.object.convert(target='MESH')

    # Now generate faces from outline in Edit Mode
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    # bpy.ops.mesh.edge_face_add()
    bpy.ops.mesh.fill()  # or try grid_fill for nicer topology
    bpy.ops.object.mode_set(mode='OBJECT')

    mat_name = f"{orig_gp.active_material.name}_material"
    mat = bpy.data.materials.get(mat_name)
    if mat is None:
        mat = bpy.data.materials.new(name=mat_name)

        mat.use_nodes = True
        nodes = mat.node_tree.nodes

        # Get Principled BSDF node
        bsdf = nodes.get("Principled BSDF")
        if bsdf is None:
            raise RuntimeError("Principled BSDF node not found in material 'abc'")

        # Set RGBA color (values 0..1)
        bsdf.inputs["Base Color"].default_value = fill_color

    mesh_mats = gp.data.materials  # material slots on the mesh [web:337]
    if mat.name not in [m.name for m in mesh_mats if m]:
        mesh_mats.append(mat)

    gp.active_material = mat

    return gp


def collect_gp_objects_from_collections(collection=None):
    """
    Step 1: Recursively collect all enabled Grease Pencil objects from a collection and its nested collections.
    
    Args:
        collection: The collection to start from. If None, uses the active collection.
    
    Returns:
        List of enabled Grease Pencil objects found in the collection hierarchy
    """
    # Get the collection to process
    if collection is None:
        collection = bpy.context.collection
    
    if collection is None:
        raise RuntimeError("No collection specified and no active collection found")
    
    gp_objects = []
    
    def _collect_from_collection(col, visited=None):
        """Recursive helper to collect GP objects from a collection and its children."""
        if visited is None:
            visited = set()
        
        # Avoid processing the same collection twice
        if col in visited:
            return
        visited.add(col)
        
        print(f"Scanning collection: {col.name}")
        
        # Find all enabled Grease Pencil objects in the current collection
        for obj in col.objects:
            # Check if object is a Grease Pencil
            if obj.type not in {'GPENCIL', 'GREASEPENCIL'}:
                continue
            
            # Check if object is not disabled (not hidden in viewport and visible)
            if obj.hide_get() or obj.hide_viewport:
                print(f"  Skipping disabled/hidden GP: {obj.name}")
                continue
            
            gp_objects.append(obj)
            print(f"  Found enabled GP: {obj.name}")
        
        # Recursively process nested collections
        for child_collection in col.children:
            _collect_from_collection(child_collection, visited)
    
    # Start collection from the root collection
    _collect_from_collection(collection)
    
    print(f"\nTotal found: {len(gp_objects)} enabled Grease Pencil object(s)")
    return gp_objects


def process_collection_gp_to_mesh(collection=None, keep_original=True):
    """
    Step 2: Process all enabled Grease Pencil objects from collections.
    First collects all GP objects, then processes each one.
    
    Args:
        collection: The collection to start from. If None, uses the active collection.
        keep_original: Whether to keep the original GP objects (default: True)
    
    Returns:
        List of created mesh objects
    """
    # Step 1: Collect all GP objects from collections
    gp_objects = collect_gp_objects_from_collections(collection)
    
    if not gp_objects:
        print("No enabled Grease Pencil objects found to process")
        return []
    
    # Step 2: Process each GP object
    print(f"\nProcessing {len(gp_objects)} Grease Pencil object(s)...")
    created_meshes = []
    
    for gp_obj in gp_objects:
        try:
            print(f"\nProcessing GP: {gp_obj.name}")
            
            # Make this object active and selected
            bpy.context.view_layer.objects.active = gp_obj
            gp_obj.select_set(True)
            
            # Deselect all other objects
            for obj in bpy.context.selected_objects:
                if obj != gp_obj:
                    obj.select_set(False)
            
            # Process the GP to mesh
            mesh_obj = gp_to_mesh(gp=gp_obj, keep_original=keep_original)
            created_meshes.append(mesh_obj)
            print(f"Created mesh: {mesh_obj.name}")
            
        except Exception as e:
            print(f"Error processing {gp_obj.name}: {e}")
            continue
    
    # Enable material preview mode
    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    space.shading.type = 'MATERIAL'
    
    print(f"\nSuccessfully created {len(created_meshes)} mesh object(s)")
    return created_meshes


# Example usage:
# Process the active collection
meshes = process_collection_gp_to_mesh(keep_original=True)
# print(f"Created {len(meshes)} mesh object(s)")

# Or process a specific collection:
# collection = bpy.data.collections.get("MyCollection")
# if collection:
#     meshes = process_collection_gp_to_mesh(collection=collection, keep_original=True)