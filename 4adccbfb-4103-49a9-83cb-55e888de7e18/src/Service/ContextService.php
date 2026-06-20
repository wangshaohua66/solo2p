<?php

namespace App\Service;

use App\Entity\Exhibition;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\RequestStack;

/**
 * 会话上下文：当前角色、当前展会、按角色定制的导航菜单。
 */
class ContextService
{
    public const ROLES = [
        'organizer' => '主办方·运营',
        'sales' => '主办方·销售经理',
        'finance' => '主办方·财务',
        'gm' => '主办方·总经理',
        'exhibitor' => '参展商',
        'provider' => '服务商',
    ];

    private const MENU = [
        'organizer' => ['home', 'exhibition', 'booth', 'contract', 'service', 'visitor', 'dashboard'],
        'sales' => ['home', 'booth', 'contract', 'dashboard'],
        'finance' => ['home', 'contract', 'dashboard'],
        'gm' => ['home', 'contract', 'dashboard'],
        'exhibitor' => ['home', 'booth', 'service', 'contract'],
        'provider' => ['home', 'service'],
    ];

    private const MENU_ITEMS = [
        'home' => ['label' => '工作台', 'route' => 'app_home', 'icon' => 'bi-house-door'],
        'exhibition' => ['label' => '展会管理', 'route' => 'app_exhibition_index', 'icon' => 'bi-calendar2-event'],
        'booth' => ['label' => '展位管理', 'route' => 'app_booth_index', 'icon' => 'bi-grid-1x2'],
        'contract' => ['label' => '合同管理', 'route' => 'app_contract_index', 'icon' => 'bi-file-earmark-text'],
        'service' => ['label' => '服务工单', 'route' => 'app_service_index', 'icon' => 'bi-headset'],
        'visitor' => ['label' => '观众登记', 'route' => 'app_visitor_index', 'icon' => 'bi-person-badge'],
        'dashboard' => ['label' => '数据看板', 'route' => 'app_dashboard', 'icon' => 'bi-graph-up-arrow'],
    ];

    public function __construct(private readonly RequestStack $requestStack, private readonly EntityManagerInterface $em)
    {
    }

    public function getRole(): string
    {
        return $this->requestStack->getSession()->get('role', 'organizer');
    }

    public function setRole(string $role): void
    {
        if (isset(self::ROLES[$role])) {
            $this->requestStack->getSession()->set('role', $role);
        }
    }

    public function getRoleLabel(): string
    {
        return self::ROLES[$this->getRole()] ?? '主办方·运营';
    }

    public function getRoles(): array
    {
        return self::ROLES;
    }

    public function getMenu(): array
    {
        $role = $this->getRole();
        $keys = self::MENU[$role] ?? self::MENU['organizer'];
        $menu = [];
        foreach ($keys as $key) {
            if (isset(self::MENU_ITEMS[$key])) {
                $menu[$key] = self::MENU_ITEMS[$key];
            }
        }

        return $menu;
    }

    public function getCurrentExhibitionId(): ?int
    {
        $id = $this->requestStack->getSession()->get('exhibition_id');

        return $id ? (int) $id : null;
    }

    public function setCurrentExhibitionId(int $id): void
    {
        $this->requestStack->getSession()->set('exhibition_id', $id);
    }

    public function getCurrentExhibition(): ?Exhibition
    {
        $id = $this->getCurrentExhibitionId();
        if ($id) {
            return $this->em->find(Exhibition::class, $id);
        }
        $first = $this->em->getRepository(Exhibition::class)->findOneBy([], ['id' => 'DESC']);
        if ($first) {
            $this->setCurrentExhibitionId($first->getId());
        }

        return $first;
    }

    /** @return Exhibition[] */
    public function getExhibitions(): array
    {
        return $this->em->getRepository(Exhibition::class)->findBy([], ['id' => 'DESC']);
    }
}
