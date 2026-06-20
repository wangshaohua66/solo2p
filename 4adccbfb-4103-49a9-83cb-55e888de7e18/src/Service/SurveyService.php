<?php

namespace App\Service;

use App\Entity\Exhibition;
use App\Entity\SatisfactionSurvey;
use Doctrine\ORM\EntityManagerInterface;

class SurveyService
{
    public function __construct(private readonly EntityManagerInterface $em) {}

    public function getByExhibition(?Exhibition $ex): array
    {
        if (!$ex) {
            return $this->emptyResult();
        }
        $surveys = $this->em->getRepository(SatisfactionSurvey::class)->findBy(['exhibition' => $ex]);
        if (empty($surveys)) {
            return $this->emptyResult();
        }

        $dimAvg = ['venue' => 0, 'service' => 0, 'organization' => 0, 'traffic' => 0, 'overall' => 0];
        $dimCount = count($surveys);
        $industryAvg = [];
        $industryCount = [];
        $feedbackList = [];
        $totalScore = 0;

        foreach ($surveys as $s) {
            $dimAvg['venue'] += $s->getVenue();
            $dimAvg['service'] += $s->getService();
            $dimAvg['organization'] += $s->getOrganization();
            $dimAvg['traffic'] += $s->getTraffic();
            $dimAvg['overall'] += $s->getOverall();
            $totalScore += $s->getAverageScore();
            $ind = $s->getExhibitor()?->getIndustry() ?: '综合';
            $industryAvg[$ind] = ($industryAvg[$ind] ?? 0) + $s->getAverageScore();
            $industryCount[$ind] = ($industryCount[$ind] ?? 0) + 1;
            if ($s->getFeedback()) {
                $feedbackList[] = [
                    'company' => $s->getExhibitor()?->getName(),
                    'score' => $s->getAverageScore(),
                    'content' => $s->getFeedback(),
                ];
            }
        }
        foreach ($dimAvg as $k => $v) {
            $dimAvg[$k] = round($v / $dimCount, 2);
        }
        foreach ($industryAvg as $k => $v) {
            $industryAvg[$k] = round($v / $industryCount[$k], 2);
        }
        arsort($industryAvg);

        // 评分分布：1-2 不满意，3 一般，4-5 满意
        $dist = ['不满意' => 0, '一般' => 0, '满意' => 0];
        foreach ($surveys as $s) {
            $score = $s->getOverall();
            if ($score <= 2) { ++$dist['不满意']; }
            elseif ($score === 3) { ++$dist['一般']; }
            else { ++$dist['满意']; }
        }

        return [
            'count' => $dimCount,
            'average' => round($totalScore / $dimCount, 2),
            'dimensions' => $dimAvg,
            'industryRank' => $industryAvg,
            'distribution' => $dist,
            'feedbacks' => array_slice($feedbackList, 0, 10),
        ];
    }

    private function emptyResult(): array
    {
        return [
            'count' => 0, 'average' => 0,
            'dimensions' => ['venue' => 0, 'service' => 0, 'organization' => 0, 'traffic' => 0, 'overall' => 0],
            'industryRank' => [], 'distribution' => ['不满意' => 0, '一般' => 0, '满意' => 0], 'feedbacks' => [],
        ];
    }
}
