from pathlib import Path

from PIL import Image


SOURCE = Path(r"C:\Users\Huy\Downloads\0ad4a51e-8ea0-46bd-98a1-a2c9a75628bf.png")
OUTPUT_DIR = Path("frontend/icons/milestones")

# Coordinates are left, top, right, bottom in the provided 1536x1024 sheet.
CROPS = {
    "first-smile.png": (24, 115, 208, 353),
    "reaching-grabbing.png": (223, 115, 399, 353),
    "rolling-over.png": (416, 115, 578, 353),
    "army-crawling.png": (608, 115, 773, 353),
    "sitting-up.png": (792, 115, 955, 353),
    "crawling.png": (970, 115, 1135, 353),
    "first-syllables.png": (1151, 115, 1321, 353),
    "walking.png": (1341, 115, 1507, 353),
    "tracks-faces.png": (0, 588, 146, 810),
    "hands-to-mouth.png": (159, 588, 290, 810),
    "responds-to-name.png": (302, 588, 433, 810),
    "transfers-toy-hand-to-hand.png": (447, 588, 574, 810),
    "peekaboo-understanding.png": (581, 588, 707, 810),
    "waves-bye-bye.png": (718, 588, 844, 810),
    "claps-hands.png": (852, 588, 976, 810),
    "finger-feeding.png": (985, 588, 1107, 810),
    "drinks-from-cup.png": (1119, 588, 1242, 810),
    "points-with-finger.png": (1253, 588, 1377, 810),
    "eats-solids.png": (1389, 588, 1522, 810),
}


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    sheet = Image.open(SOURCE).convert("RGBA")
    for filename, box in CROPS.items():
        icon = sheet.crop(box)
        icon.save(OUTPUT_DIR / filename)
    print(f"Saved {len(CROPS)} milestone icons to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
