import json
import os

def generate_detections_json(detections, output_path):
    """
    Generates the detections.json file according to the required schema.
    
    Args:
        detections (list of dict): List of detection dictionaries.
            Each dict should have:
                - 'type': str ("scratch" or "edge_damage")
                - 'bbox_coordinates': list of int [x_min, y_min, x_max, y_max]
        output_path (str): Full path to save the .json file
    """
    output_dict = {}
    
    for i, det in enumerate(detections, start=1):
        output_dict[str(i)] = {
            "type": det["type"],
            "bbox_coordinates": det["bbox_coordinates"]
        }
        
    with open(output_path, 'w') as f:
        json.dump(output_dict, f, indent=4)
