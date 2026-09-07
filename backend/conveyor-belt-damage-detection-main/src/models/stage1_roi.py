from src.models.base_model import BaseModel

class Stage1ROIModel(BaseModel):
    def __init__(self, weights_path="best_stage1.pt"):
        """
        Model to extract the conveyor belt ROI from the original image.
        """
        super().__init__(weights_path)
        
    def get_belt_crop(self, image, conf=0.25):
        """
        Predicts the belt ROI and returns the cropped image and its offset.
        
        Args:
            image: OpenCV image (numpy array).
            conf (float): Confidence threshold.
            
        Returns:
            tuple: (cropped_image, (x_offset, y_offset))
                   Returns (None, None) if no belt is detected.
        """
        results = self.predict(image, conf=conf)
        
        if len(results.boxes) == 0:
            return None, None
            
        # Get the highest confidence box
        best_box = results.boxes[0]
        x_min, y_min, x_max, y_max = map(int, best_box.xyxy[0].tolist())
        
        # Ensure within bounds
        h, w, _ = image.shape
        x_min, y_min = max(0, x_min), max(0, y_min)
        x_max, y_max = min(w, x_max), min(h, y_max)
        
        crop = image[y_min:y_max, x_min:x_max]
        offset = (x_min, y_min)
        
        return crop, offset
