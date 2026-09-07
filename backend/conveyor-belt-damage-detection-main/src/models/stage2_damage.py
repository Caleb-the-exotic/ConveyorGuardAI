from src.models.base_model import BaseModel

class Stage2DamageModel(BaseModel):
    def __init__(self, weights_path="best_stage2.pt"):
        """
        Model to detect "scratch" and "edge_damage" on the cropped belt ROI.
        """
        super().__init__(weights_path)
        
    def get_damage_detections(self, crop_image, conf=0.25):
        """
        Predicts damage on the cropped belt image.
        
        Args:
            crop_image: OpenCV image (numpy array) of the cropped belt.
            conf (float): Confidence threshold.
            
        Returns:
            list: List of dictionaries containing 'type' and 'bbox_coordinates' (relative to crop).
        """
        results = self.predict(crop_image, conf=conf)
        
        detections = []
        for box in results.boxes:
            class_id = int(box.cls[0].item())
            class_name = self.model.names[class_id]
            
            x_min, y_min, x_max, y_max = map(int, box.xyxy[0].tolist())
            
            detections.append({
                "type": class_name,
                "bbox_coordinates": [x_min, y_min, x_max, y_max]
            })
            
        return detections
