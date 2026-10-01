import urllib.request
import os

url = "https://upload.wikimedia.org/wikipedia/en/c/c5/Indian_Institute_of_Information_Technology%2C_Bhagalpur_logo.png"
output = "public/iiit_logo_raw.png"

try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response, open(output, 'wb') as out_file:
        data = response.read()
        out_file.write(data)
    print("Logo downloaded successfully.")
except Exception as e:
    print(f"Failed to download: {e}")
