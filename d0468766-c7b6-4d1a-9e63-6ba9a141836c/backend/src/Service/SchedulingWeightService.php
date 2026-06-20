<?php

namespace App\Service;

use App\Document\Movie;
use Doctrine\ODM\MongoDB\DocumentManager;

readonly class SchedulingWeightService
{
    public function __construct(private DocumentManager $dm)
    {
    }

    public function calculate(Movie $movie, ?int $daysSinceRelease = null): array
    {
        if ($daysSinceRelease === null) {
            $today = new \DateTimeImmutable();
            $diff = $today->diff($movie->getReleaseDate());
            $daysSinceRelease = max(0, (int)$diff->format('%a'));
        }

        $boxOffice = $movie->getBoxOffice();
        $rating = $movie->getRating();
        $duration = $movie->getDuration();

        $boxOfficeScore = min(1.0, $boxOffice / 500000000);
        $ratingScore = $rating / 10;
        $durationScore = $duration < 100 ? 0.9 : ($duration > 150 ? 0.7 : 1.0);
        $decayScore = max(0.3, 1 - $daysSinceRelease * 0.04);

        $weight = round(
            $boxOfficeScore * 0.45
            + $ratingScore * 0.30
            + $durationScore * 0.10
            + $decayScore * 0.15,
            2
        );

        return [
            'movieId' => $movie->getId(),
            'weight' => $weight,
            'boxOfficeScore' => round($boxOfficeScore, 4),
            'ratingScore' => round($ratingScore, 4),
            'durationScore' => $durationScore,
            'decayScore' => round($decayScore, 4),
            'daysSinceRelease' => $daysSinceRelease,
            'boxOffice' => $boxOffice,
            'rating' => $rating,
        ];
    }

    public function recalculateAll(): void
    {
        $cursor = $this->dm->createQueryBuilder(Movie::class)->getQuery()->execute();
        foreach ($cursor as $movie) {
            /** @var Movie $movie */
            $result = $this->calculate($movie);
            $movie->setSchedulingWeight($result['weight']);
        }
        $this->dm->flush();
    }
}
