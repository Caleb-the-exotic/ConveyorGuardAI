import os
import random
import shutil
import glob

def create_test_set(source_dir="train/train/images", dest_dir="train/test_images", num_images=20):
    """
    Randomly selects images from the source directory and copies them to the destination directory.
    """
    os.makedirs(dest_dir, exist_ok=True)
    
    # Get all images
    all_images = glob.glob(os.path.join(source_dir, "*.jpg"))
    
    if not all_images:
        print(f"No images found in {source_dir}")
        return
        
    # Ensure we don't try to select more images than exist
    num_images = min(num_images, len(all_images))
    
    # Randomly select images
    selected_images = random.sample(all_images, num_images)
    
    print(f"Copying {num_images} random images to {dest_dir}...")
    
    for img_path in selected_images:
        filename = os.path.basename(img_path)
        dest_path = os.path.join(dest_dir, filename)
        shutil.copy2(img_path, dest_path)
        
    print("Done!")

if __name__ == "__main__":
    create_test_set()
