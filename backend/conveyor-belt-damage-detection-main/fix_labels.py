import os
import glob

def fix_negative_yolo_labels(dataset_dir="data/stage2_dataset"):
    """
    Fixes negative width/height values in YOLO label files caused by drawing 
    bounding boxes from bottom-right to top-left in the annotation tool.
    """
    label_files = glob.glob(os.path.join(dataset_dir, "*.txt"))
    fixed_count = 0
    
    for file_path in label_files:
        with open(file_path, 'r') as f:
            lines = f.readlines()
            
        new_lines = []
        file_modified = False
        
        for line in lines:
            if not line.strip():
                continue
                
            parts = line.strip().split()
            if len(parts) >= 5:
                class_id = parts[0]
                xc = float(parts[1])
                yc = float(parts[2])
                w = float(parts[3])
                h = float(parts[4])
                
                # If width or height is negative, it means the box was drawn backwards.
                # Taking the absolute value fixes the dimensions.
                if w < 0 or h < 0:
                    w = abs(w)
                    h = abs(h)
                    file_modified = True
                
                # Ensure values don't exceed 1.0 (image boundaries)
                xc = min(max(xc, 0.0), 1.0)
                yc = min(max(yc, 0.0), 1.0)
                w = min(max(w, 0.0), 1.0)
                h = min(max(h, 0.0), 1.0)
                
                new_lines.append(f"{class_id} {xc:.6f} {yc:.6f} {w:.6f} {h:.6f}\n")
            else:
                new_lines.append(line)
                
        if file_modified:
            with open(file_path, 'w') as f:
                f.writelines(new_lines)
            fixed_count += 1
            
    print(f"Checked {len(label_files)} files. Fixed negative values in {fixed_count} files.")

if __name__ == "__main__":
    fix_negative_yolo_labels()
