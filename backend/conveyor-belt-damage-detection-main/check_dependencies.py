#!/usr/bin/env python3
"""
Check if all required dependencies are installed.
"""

import sys

def check_dependency(module_name, package_name=None):
    """Check if a dependency is installed."""
    if package_name is None:
        package_name = module_name
        
    try:
        __import__(module_name)
        print(f"✓ {package_name}")
        return True
    except ImportError:
        print(f"✗ {package_name} - Not installed!")
        return False

def main():
    print("=" * 40)
    print("CHECKING DEPENDENCIES")
    print("=" * 40)
    
    dependencies = [
        ("ultralytics", "ultralytics"),
        ("torch", "torch"), 
        ("cv2", "opencv-python"),
        ("numpy", "numpy")
    ]
    
    all_installed = True
    
    for module, package in dependencies:
        if not check_dependency(module, package):
            all_installed = False
    
    print("\n" + "=" * 40)
    
    if all_installed:
        print("✓ All dependencies are installed!")
        print("You can proceed with the project.")
    else:
        print("✗ Some dependencies are missing.")
        print("Please install them using:")
        print("pip install -r requirements.txt")
    
    print("=" * 40)

if __name__ == "__main__":
    main()