using ExifLib;
using CampHub.Models;

namespace CampHub.Services;

public class ExifService
{
    public (decimal? Lat, decimal? Lng, DateTime? TakenAt) ExtractMetadata(Stream imageStream)
    {
        decimal? lat = null;
        decimal? lng = null;
        DateTime? takenAt = null;

        try
        {
            imageStream.Position = 0;
            using var reader = new ExifReader(imageStream);

            if (reader.GetTagValue(ExifTags.DateTimeOriginal, out DateTime dt))
            {
                takenAt = DateTime.SpecifyKind(dt, DateTimeKind.Utc);
            }
            else if (reader.GetTagValue(ExifTags.DateTimeDigitized, out DateTime dt2))
            {
                takenAt = DateTime.SpecifyKind(dt2, DateTimeKind.Utc);
            }

            try
            {
                if (reader.GetTagValue(ExifTags.GPSLatitude, out double[]? gpsLat)
                    && reader.GetTagValue(ExifTags.GPSLatitudeRef, out string? latRef)
                    && reader.GetTagValue(ExifTags.GPSLongitude, out double[]? gpsLng)
                    && reader.GetTagValue(ExifTags.GPSLongitudeRef, out string? lngRef))
                {
                    if (gpsLat?.Length == 3 && gpsLng?.Length == 3)
                    {
                        var latDecimal = ConvertDegreeToDecimal(gpsLat[0], gpsLat[1], gpsLat[2]);
                        if (latRef?.ToUpperInvariant() == "S") latDecimal = -latDecimal;

                        var lngDecimal = ConvertDegreeToDecimal(gpsLng[0], gpsLng[1], gpsLng[2]);
                        if (lngRef?.ToUpperInvariant() == "W") lngDecimal = -lngDecimal;

                        lat = (decimal)Math.Round(latDecimal, 6);
                        lng = (decimal)Math.Round(lngDecimal, 6);
                    }
                }
            }
            catch
            {
                // GPS tags may be missing
            }
        }
        catch
        {
            // Exif extraction failed, return defaults
        }
        finally
        {
            if (imageStream.CanSeek) imageStream.Position = 0;
        }

        return (lat, lng, takenAt);
    }

    private static double ConvertDegreeToDecimal(double deg, double min, double sec)
    {
        return deg + (min / 60.0) + (sec / 3600.0);
    }
}
