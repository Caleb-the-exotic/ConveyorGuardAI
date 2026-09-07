import os
import cv2
import glob
import numpy as np

def visualize_polygons(data_dir="train/train/images", labels_dir="train/train/labels", output_dir="polygon_visualization", max_images=20):
    """
    Visualize the YOLO segmentation masks (polygons) and their bounding boxes.
    """
    os.makedirs(output_dir, exist_ok=True)
    
    image_paths = sorted(glob.glob(os.path.join(data_dir, "*.jpg")))[:max_images]
    print(f"Processing {len(image_paths)} images...")
    
    for img_path in image_paths:
        filename = os.path.basename(img_path)
        label_path = os.path.join(labels_dir, filename.replace(".jpg", ".txt"))
        
        if not os.path.exists(label_path):
            print(f"No label file for {filename}")
            continue
            
        img = cv2.imread(img_path)
        if img is None:
            print(f"Could not load image: {filename}")
            continue
            
        h, w, _ = img.shape
        
        with open(label_path, 'r') as f:
            lines = f.readlines()
            
        for line in lines:
            parts = line.strip().split()
            if len(parts) >= 5: # class + at least 2 points (though a valid polygon needs 3)
                try:
                    class_id = int(float(parts[0]))
                    coords = list(map(float, parts[1:]))
                    
                    # Group into (x, y) pairs and convert to pixel coordinates
                    points = []
                    for i in range(0, len(coords), 2):
                        if i+1 < len(coords):
                            x = int(coords[i] * w)
                            y = int(coords[i+1] * h)
                            points.append([x, y])
                            
                    if len(points) >= 3:
                        # Convert to numpy array for cv2.polylines
                        pts = np.array(points, np.int32)
                        pts = pts.reshape((-1, 1, 2))
                        
                        # Draw the polygon outline in GREEN
                        cv2.polylines(img, [pts], isClosed=True, color=(0, 255, 0), thickness=4)
                        
                        # Calculate the bounding box of the polygon
                        x_coords = [p[0] for p in points]
                        y_coords = [p[1] for p in points]
                        x_min, x_max = min(x_coords), max(x_coords)
                        y_min, y_max = min(y_coords), max(y_coords)
                        
                        # Draw the bounding box in RED
                        cv2.rectangle(img, (x_min, y_min), (x_max, y_max), (0, 0, 255), 3)
                        
                        # Add a label
                        cv2.putText(img, "Belt Outline (Green) / Crop Box (Red)", (x_min, max(30, y_min-10)), 
                                   cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 0), 3)
                except Exception as e:
                    print(f"Error parsing line in {filename}: {e}")
                    
        out_path = os.path.join(output_dir, filename)
        cv2.imwrite(out_path, img)
        print(f"Saved: {out_path}")

if __name__ == "__main__":
    visualize_polygons()