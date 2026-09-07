from ultralytics import YOLO

class BaseModel:
    def __init__(self, weights_path):
        """
        Base wrapper for YOLOv8 models.
        
        Args:
            weights_path (str): Path to the trained .pt weights file.
        """
        self.model = YOLO(weights_path)
        
    def predict(self, image, conf=0.25):
        """
        Run inference on an image.
        
        Args:
            image: OpenCV image (numpy array) or path to image.
            conf (float): Confidence threshold.
            
        Returns:
            list: List of predictions.
        """
        results = self.model(image, conf=conf, verbose=False)
        return results[0]
