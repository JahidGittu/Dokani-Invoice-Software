UPDATE products 
SET sqft_per_box = ROUND(CAST(
  (CAST(height AS numeric) * CAST(width AS numeric) * pieces_per_box) / 929.0304 
AS numeric), 2)
WHERE unit = 'SQFT' 
AND height != '' AND width != '' 
AND CAST(height AS numeric) > 0 AND CAST(width AS numeric) > 0
AND sqft_per_box = 0;