import argparse
import os
import cv2
import glob

from src.models.stage1_roi import Stage1ROIModel
from src.models.stage2_damage import Stage2DamageModel
from src.utils.image_processing import map_coordinates_to_original
from src.utils.json_formatter import generate_detections_json

def process_image(img_path, stage1_model, stage2_model, output_dir):
    """
    Processes a single image through the two-stage pipeline.
    """
    filename = os.path.basename(img_path)
    img_name, ext = os.path.splitext(filename)
    
    # Read image
    img = cv2.imread(img_path)
    if img is None:
        print(f"Error: Could not read image {img_path}")
        return
        
    annotated_img = img.copy()
    
    # Stage 1: Extract Belt ROI
    crop, offset = stage1_model.get_belt_crop(img)
    
    final_detections = []
    
    if crop is not None and crop.size > 0:
        # Stage 2: Detect Damage on Crop
        # crop_detections = stage2_model.get_damage_detections(crop)
        crop_detections = stage2_model.get_damage_detections(crop, conf=0.015)
        
        # Map coordinates back to original image and draw boxes
        for det in crop_detections:
            orig_coords = map_coordinates_to_original(det["bbox_coordinates"], offset)
            
            final_detections.append({
                "type": det["type"],
                "bbox_coordinates": orig_coords
            })
            
            # Draw bounding box on original image
            x_min, y_min, x_max, y_max = orig_coords
            color = (0, 0, 255) if det["type"] == "scratch" else (0, 255, 255) # Red for scratch, Yellow for edge_damage
            cv2.rectangle(annotated_img, (x_min, y_min), (x_max, y_max), color, 2)
            cv2.putText(annotated_img, det["type"], (x_min, max(0, y_min - 5)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
    else:
        print(f"Warning: No belt ROI detected in {filename}")
        
    # Save Outputs
    out_img_path = os.path.join(output_dir, f"{img_name}.jpg")
    out_json_path = os.path.join(output_dir, f"{img_name}.json")
    
    cv2.imwrite(out_img_path, annotated_img)
    generate_detections_json(final_detections, out_json_path)

def get_latest_model(stage_dir):
    """
    Finds the most recently trained model weights in the specified stage directory.
    """
    if not os.path.exists(stage_dir):
        return None
        
    # Get all subdirectories (e.g., belt_roi_model, belt_roi_model2) sorted by modification time
    subdirs = sorted(glob.glob(os.path.join(stage_dir, "*/")), key=os.path.getmtime, reverse=True)
    
    for subdir in subdirs:
        weights_path = os.path.join(subdir, "weights", "best.pt")
        if os.path.exists(weights_path):
            return weights_path
            
    return None

def main():
    parser = argparse.ArgumentParser(description="Conveyor Belt Damage Detection Pipeline")
    parser.add_argument("--image_dir", type=str, required=True, help="Path to the directory containing input images")
    parser.add_argument("--output_dir", type=str, required=True, help="Path to the directory where outputs will be saved")
    args = parser.parse_args()
    
    os.makedirs(args.output_dir, exist_ok=True)
    
    # Initialize models by finding the latest trained weights
    stage1_weights = get_latest_model("runs/detect/runs/stage1")
    stage2_weights = get_latest_model("runs/detect/runs/stage2")
    
    if not stage1_weights:
        print("Error: Stage 1 (Belt ROI) model weights not found. Please train Stage 1 first.")
        return
        
    if not stage2_weights:
        print("Error: Stage 2 (Damage Detection) model weights not found. Please train Stage 2 first.")
        return
        
    print(f"Using Stage 1 weights: {stage1_weights}")
    print(f"Using Stage 2 weights: {stage2_weights}")
        
    try:
        stage1_model = Stage1ROIModel(stage1_weights)
        stage2_model = Stage2DamageModel(stage2_weights)
    except Exception as e:
        print(f"Error loading models: {e}")
        return
        
    # Process images
    image_paths = glob.glob(os.path.join(args.image_dir, "*.jpg")) + glob.glob(os.path.join(args.image_dir, "*.jpeg")) + glob.glob(os.path.join(args.image_dir, "*.png"))
    
    if not image_paths:
        print(f"No images found in {args.image_dir}")
        return
        
    for img_path in image_paths:
        print(f"Processing {os.path.basename(img_path)}...")
        process_image(img_path, stage1_model, stage2_model, args.output_dir)
        
    print(f"Processing complete. Outputs saved to {args.output_dir}")

if __name__ == "__main__":
    main()
