<?php

namespace App\Controller;

use App\Entity\Visitor;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class VisitorController extends AbstractAppController
{
    #[Route('/visitor', name: 'app_visitor_index', methods: ['GET'])]
    public function index(): Response
    {
        $ex = $this->currentExhibition();
        $stats = $this->stats($ex);
        $recent = $ex ? $this->em->getRepository(Visitor::class)->findBy(['exhibition' => $ex], ['id' => 'DESC'], 12) : [];
        $profile = $this->profileStats($ex);

        return $this->render('visitor/index.html.twig', $this->viewVars([
            'ex' => $ex, 'stats' => $stats, 'recent' => $recent, 'profile' => $profile,
        ]));
    }

    /** 移动端购票/登记页 */
    #[Route('/visitor/register', name: 'app_visitor_register', methods: ['GET'])]
    public function register(): Response
    {
        return $this->render('visitor/register.html.twig', $this->viewVars([
            'ex' => $this->currentExhibition(),
            'ageGroups' => Visitor::AGE_GROUPS,
            'genders' => Visitor::GENDERS,
            'positions' => Visitor::POSITIONS,
            'industries' => Visitor::VISITOR_INDUSTRIES,
            'regions' => Visitor::REGIONS,
        ]));
    }

    #[Route('/visitor/ticket', name: 'app_visitor_ticket', methods: ['POST'])]
    public function issueTicket(Request $request): JsonResponse
    {
        $ex = $this->currentExhibition();
        if (!$ex) { return $this->jsonError('请先选择展会'); }
        $type = in_array($request->request->get('type'), [Visitor::TYPE_PROFESSIONAL, Visitor::TYPE_PUBLIC], true) ? $request->request->get('type') : Visitor::TYPE_PUBLIC;
        $code = 'V'.$ex->getId().'-'.strtoupper(substr(md5(uniqid('', true)), 0, 8));
        $v = (new Visitor())
            ->setExhibition($ex)
            ->setName(trim((string) $request->request->get('name')) ?: null)
            ->setPhone(trim((string) $request->request->get('phone')) ?: null)
            ->setType($type)
            ->setTicketCode($code)
            ->setAgeGroup(in_array($request->request->get('ageGroup'), Visitor::AGE_GROUPS, true) ? $request->request->get('ageGroup') : null)
            ->setGender(array_key_exists($request->request->get('gender'), Visitor::GENDERS) ? $request->request->get('gender') : null)
            ->setCompany(trim((string) $request->request->get('company')) ?: null)
            ->setPosition(in_array($request->request->get('position'), Visitor::POSITIONS, true) ? $request->request->get('position') : null)
            ->setIndustry(in_array($request->request->get('industry'), Visitor::VISITOR_INDUSTRIES, true) ? $request->request->get('industry') : null)
            ->setRegion(in_array($request->request->get('region'), Visitor::REGIONS, true) ? $request->request->get('region') : null);
        $this->em->persist($v);
        $this->em->flush();

        return $this->jsonOk(['ticketCode' => $code, 'id' => $v->getId(), 'type' => $type, 'redirect' => $this->generateUrl('app_visitor_ticket_view', ['id' => $v->getId()])], '电子票已生成');
    }

    #[Route('/visitor/ticket/{id}', name: 'app_visitor_ticket_view', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function ticketView(Visitor $visitor): Response
    {
        return $this->render('visitor/ticket.html.twig', $this->viewVars(['v' => $visitor]));
    }

    /** 移动端现场扫码登记 */
    #[Route('/visitor/checkin', name: 'app_visitor_checkin', methods: ['GET'])]
    public function checkinPage(): Response
    {
        return $this->render('visitor/checkin.html.twig', $this->viewVars(['ex' => $this->currentExhibition()]));
    }

    #[Route('/visitor/checkin', name: 'app_visitor_checkin_do', methods: ['POST'])]
    public function doCheckin(Request $request): JsonResponse
    {
        $ex = $this->currentExhibition();
        if (!$ex) { return $this->jsonError('请先选择展会'); }
        $code = trim((string) $request->request->get('ticketCode'));
        if (!$code) { return $this->jsonError('请输入或扫描票号'); }
        $v = $this->em->getRepository(Visitor::class)->findOneBy(['ticketCode' => $code, 'exhibition' => $ex]);
        if (!$v) { return $this->jsonError('票号无效，请核对后重试', 404); }
        if ($v->isCheckedIn()) { return $this->jsonError('该票已于 '.$v->getCheckinAt()?->format('H:i').' 入场，请勿重复登记'); }
        $v->setCheckedIn(true)->setCheckinAt(new \DateTimeImmutable());
        $this->em->flush();
        $flow = $this->cache->incrVisitorFlow($ex->getId());
        $zone = ($v->getId() % 6) + 1;
        $this->cache->incrVisitorZone($ex->getId(), $zone);

        return $this->jsonOk(['flow' => $flow, 'name' => $v->getName() ?: '观众', 'type' => $v->getType()], '入场登记成功，当前实时入场 '.$flow.' 人');
    }

    /** 实时统计接口（供看板与登记页轮询） */
    #[Route('/visitor/api/stats', name: 'app_visitor_stats', methods: ['GET'])]
    public function statsApi(): JsonResponse
    {
        $ex = $this->currentExhibition();

        return $this->json($this->stats($ex));
    }

    private function stats(?object $ex): array
    {
        if (!$ex) {
            return ['total' => 0, 'checkedIn' => 0, 'professional' => 0, 'public' => 0, 'zones' => []];
        }
        $repo = $this->em->getRepository(Visitor::class);
        $total = $repo->count(['exhibition' => $ex]);
        $pro = $repo->count(['exhibition' => $ex, 'type' => Visitor::TYPE_PROFESSIONAL]);
        $pub = $repo->count(['exhibition' => $ex, 'type' => Visitor::TYPE_PUBLIC]);
        $checkedIn = (int) $this->cache->getVisitorFlow($ex->getId());
        if (!$checkedIn) {
            $checkedIn = $repo->count(['exhibition' => $ex, 'checkedIn' => true]);
        }
        $zones = $this->cache->getVisitorZones($ex->getId());

        return [
            'total' => $total,
            'checkedIn' => $checkedIn,
            'professional' => $pro,
            'public' => $pub,
            'zones' => $zones,
        ];
    }

    private function profileStats(?object $ex): array
    {
        $empty = [
            'age' => [], 'gender' => [], 'industry' => [], 'region' => [], 'position' => [],
            'withCompany' => 0, 'total' => 0,
        ];
        if (!$ex) { return $empty; }
        $repo = $this->em->getRepository(Visitor::class);
        $visitors = $repo->findBy(['exhibition' => $ex]);
        $age = $gender = $industry = $region = $position = [];
        $withCompany = 0;
        foreach ($visitors as $v) {
            if ($v->getAgeGroup()) { $age[$v->getAgeGroup()] = ($age[$v->getAgeGroup()] ?? 0) + 1; }
            if ($v->getGender()) { $gender[$v->getGenderLabel()] = ($gender[$v->getGenderLabel()] ?? 0) + 1; }
            if ($v->getIndustry()) { $industry[$v->getIndustry()] = ($industry[$v->getIndustry()] ?? 0) + 1; }
            if ($v->getRegion()) { $region[$v->getRegion()] = ($region[$v->getRegion()] ?? 0) + 1; }
            if ($v->getPosition()) { $position[$v->getPosition()] = ($position[$v->getPosition()] ?? 0) + 1; }
            if ($v->getCompany()) { ++$withCompany; }
        }
        arsort($industry); arsort($region); arsort($position);
        foreach (Visitor::AGE_GROUPS as $g) { if (!isset($age[$g])) { $age[$g] = 0; } }
        ksort($age);

        return [
            'age' => $age, 'gender' => $gender, 'industry' => $industry, 'region' => $region, 'position' => $position,
            'withCompany' => $withCompany, 'total' => count($visitors),
        ];
    }
}
