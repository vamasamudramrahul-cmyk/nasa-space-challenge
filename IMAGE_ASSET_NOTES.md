# Home Screen Image Assets — Image Notes

## Two different image uses

### A. Featured Equipment carousel
Six direct NASA/JPL image URLs are attached to the six featured equipment records in `featured_equipment.json`. Each record includes:
- direct image URL;
- NASA/JPL source page;
- image credit;
- alt text;
- note describing exactly what the photograph depicts.

**Important:** The six carousel photographs are remote NASA/JPL image references, not local photo files in this package. The Claude prototype should load the direct URL, test that it responds, and preserve the source page and credit. If an image fails to load, show a neutral fallback and report it; do not substitute unrelated imagery.

Two Mars rover images are NASA/JPL engineering-testbed photographs:
- Spirit: JPL In-Situ Instruments Laboratory testbed image.
- Opportunity: JPL simulated Martian slope test-drive image.
They show rover test hardware, not the rover operating on Mars. The image note must remain visible in the content/evidence metadata.

### B. Equipment category illustrations
The `category-illustrations/` folder contains six separate transparent PNG illustrations:
- rovers.png
- landers.png
- spacecraft.png
- orbiters.png
- helicopters.png
- descent-stages.png

These are AI-generated conceptual category illustrations. They are decorative category artwork, not NASA photographs, not evidence, and not exact replicas of specific NASA mission hardware. They must never be used as featured equipment photographs or source evidence.

## Recommended rendering
- Category illustrations: `object-fit: contain`, transparent background, preserve full object, consistent visible size.
- Featured NASA photographs: use responsive `object-fit: contain` or carefully chosen `cover` only where no key equipment detail is cropped; preserve full image when needed.
- Always include meaningful alt text.
- Keep the photo credit/source page available in the data model.

## Source pages
- Apollo 17 Lunar Roving Vehicle: https://science.nasa.gov/resource/apollo-17-gene-cernan-in-lunar-roving-vehicle/?category=images
- Apollo 12 and Surveyor 3: https://science.nasa.gov/resource/apollo-12-and-surveyor-3/
- Apollo 11 Lunar Module on lunar surface: https://science.nasa.gov/resource/view-apollo-11-lunar-module-as-it-rested-on-lunar-surface/
- Spirit JPL testbed: https://science.nasa.gov/photojournal/95-degree-position-at-jpl-testbed/
- Opportunity JPL test drive: https://www.jpl.nasa.gov/images/pia06047-the-test-drive/
- Ingenuity at Two Years on Mars: https://www.jpl.nasa.gov/images/pia25881-ingenuity-at-two-years-on-mars/
