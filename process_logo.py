import urllib.request
from PIL import Image
import io

url = "https://upload.wikimedia.org/wikipedia/en/c/c6/Indian_Institute_of_Information_Technology%2C_Bhagalpur_logo.png"

try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        img_data = response.read()
    
    img = Image.open(io.BytesIO(img_data)).convert("RGBA")
    
    # We want to create an aesthetic rounded or padded logo
    # Let's create a 512x512 dark slate background
    bg_color = (15, 23, 42, 255) # #0f172a
    
    def create_icon(size, padding_factor=0.7):
        out = Image.new("RGBA", (size, size), bg_color)
        
        # Calculate target size for the logo
        target_h = int(size * padding_factor)
        
        # Maintain aspect ratio
        aspect = img.width / img.height
        target_w = int(target_h * aspect)
        
        if target_w > size * padding_factor:
            target_w = int(size * padding_factor)
            target_h = int(target_w / aspect)
            
        resized_logo = img.resize((target_w, target_h), Image.Resampling.LANCZOS)
        
        # Center it
        offset_x = (size - target_w) // 2
        offset_y = (size - target_h) // 2
        
        out.paste(resized_logo, (offset_x, offset_y), resized_logo)
        return out
        
    icon_512 = create_icon(512)
    icon_512.save("public/icon-512x512.png")
    
    icon_192 = create_icon(192)
    icon_192.save("public/icon-192x192.png")
    
    print("Icons processed successfully.")

except Exception as e:
    print(f"Failed: {e}")
