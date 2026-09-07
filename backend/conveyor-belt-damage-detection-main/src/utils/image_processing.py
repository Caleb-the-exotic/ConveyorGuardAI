def map_coordinates_to_original(crop_bbox, crop_offset):
    """
    Maps bounding box coordinates from a cropped region back to the original image space.
    
    Args:
        crop_bbox (list): [x_min, y_min, x_max, y_max] relative to the crop
        crop_offset (tuple): (x_offset, y_offset) of the crop's top-left corner in the original image
        
    Returns:
        list: [x_min, y_min, x_max, y_max] in the original image space
    """
    x_offset, y_offset = crop_offset
    x_min, y_min, x_max, y_max = crop_bbox
    
    return [
        int(x_min + x_offset),
        int(y_min + y_offset),
        int(x_max + x_offset),
        int(y_max + y_offset)
    ]
