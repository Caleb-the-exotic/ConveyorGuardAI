import os
import cv2
import glob

def crop_belts(data_dir="train/train/images", labels_dir="train/train/labels", output_dir="data/cropped_belts"):
    os.makedirs(output_dir, exist_ok=True)
    
    image_paths = glob.glob(os.path.join(data_dir, "*.jpg"))
    for img_path in image_paths:
        filename = os.path.basename(img_path)
        label_path = os.path.join(labels_dir, filename.replace(".jpg", ".txt"))
        
        if not os.path.exists(label_path):
            continue
            
        img = cv2.imread(img_path)
        h, w, _ = img.shape
        
        with open(label_path, 'r') as f:
            lines = f.readlines()
            
        for i, line in enumerate(lines):
            parts = line.strip().split()
            if len(parts) >= 5:
                try:
                    # Parse polygon points (YOLO segmentation format)
                    coords = list(map(float, parts[1:]))
                    
                    # Group into (x, y) pairs and convert to pixel coordinates
                    x_coords = []
                    y_coords = []
                    for j in range(0, len(coords), 2):
                        if j+1 < len(coords):
                            x_coords.append(int(coords[j] * w))
                            y_coords.append(int(coords[j+1] * h))
                            
                    if len(x_coords) >= 3:
                        # Calculate the bounding box of the polygon
                        x_min, x_max = min(x_coords), max(x_coords)
                        y_min, y_max = min(y_coords), max(y_coords)
                        
                        # Ensure within bounds
                        x_min, y_min = max(0, x_min), max(0, y_min)
                        x_max, y_max = min(w, x_max), min(h, y_max)
                        
                        # Crop
                        crop = img[y_min:y_max, x_min:x_max]
                        
                        if crop.size > 0:
                            out_name = f"{filename.replace('.jpg', '')}_crop_{i}.jpg"
                            cv2.imwrite(os.path.join(output_dir, out_name), crop)
                except Exception as e:
                    print(f"Error processing {filename} line {i}: {e}")

if __name__ == "__main__":
    crop_belts()
