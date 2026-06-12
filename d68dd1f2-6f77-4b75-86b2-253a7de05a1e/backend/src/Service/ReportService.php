<?php

namespace App\Service;

use App\Entity\WorkOrder;
use Knp\Snappy\Pdf;
use Psr\Log\LoggerInterface;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\Address;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Twig\Environment;

class ReportService
{
    public function __construct(
        private readonly Environment $twig,
        private readonly LoggerInterface $logger,
        private readonly MailerInterface $mailer,
        private readonly UrlGeneratorInterface $router,
        private readonly string $pdfDirectory,
        private readonly string $reportSenderEmail = 'service@watchstudio.com',
        private readonly string $reportSenderName = '腕表维修服务中心',
    ) {
        if (!is_dir($this->pdfDirectory)) {
            @mkdir($this->pdfDirectory, 0755, true);
        }
    }

    public function generateServiceReportData(WorkOrder $order): array
    {
        $customer = $order->getCustomer();
        $movement = $order->getMovement();
        $inspection = $order->getInspection();

        $beforeImages = [];
        $afterImages = [];
        $duringImages = [];

        foreach ($order->getImages() as $img) {
            $item = [
                'id' => $img->getId(),
                'url' => $img->getPublicUrl(),
                'caption' => $img->getCaption() ?? '',
                'type' => $img->getType(),
            ];
            switch ($img->getType()) {
                case 'intake': $beforeImages[] = $item; break;
                case 'after': $afterImages[] = $item; break;
                case 'during': $duringImages[] = $item; break;
            }
        }

        $partUsages = [];
        foreach ($order->getPartUsages() as $usage) {
            $partUsages[] = [
                'name' => $usage->getPart()?->getName() ?? '未知配件',
                'sku' => $usage->getPart()?->getSku() ?? '',
                'quantity' => $usage->getQuantity(),
                'unitPrice' => (float)$usage->getUnitPrice(),
                'subtotal' => (float)$usage->getUnitPrice() * $usage->getQuantity(),
                'batchNumber' => $usage->getBatchNumber() ?? '无',
            ];
        }

        $serviceItems = [];
        foreach ($order->getServiceItems() as $item) {
            $serviceItems[] = [
                'type' => $item->getType(),
                'name' => $item->getName(),
                'description' => $item->getDescription() ?? '',
                'quantity' => $item->getQuantity(),
                'unitPrice' => (float)$item->getUnitPrice(),
                'subtotal' => (float)$item->getUnitPrice() * $item->getQuantity(),
            ];
        }

        $progress = [];
        foreach ($order->getLogs() as $log) {
            $progress[] = [
                'action' => $log->getAction(),
                'detail' => $log->getDetail() ?? '',
                'user' => $log->getUser()?->getName() ?? '系统',
                'time' => $log->getCreatedAt()?->format('Y-m-d H:i') ?? '',
                'ip' => $log->getIpAddress() ?? '',
            ];
        }

        $warranty = $order->getWarranty();
        $warrantyData = $warranty ? [
            'months' => $warranty->getMonths(),
            'startDate' => $warranty->getStartDate()?->format('Y-m-d'),
            'endDate' => $warranty->getEndDate()?->format('Y-m-d'),
            'status' => $warranty->getStatus(),
        ] : null;

        $pickupCode = $this->generatePickupCode($order);

        return [
            'orderNumber' => $order->getOrderNumber(),
            'generatedAt' => (new \DateTimeImmutable())->format('Y-m-d H:i:s'),
            'customer' => [
                'name' => $customer?->getName() ?? '未知客户',
                'phone' => $customer?->getPhone() ?? '',
                'email' => $customer?->getEmail() ?? '',
                'id' => $customer?->getId(),
            ],
            'watch' => [
                'brand' => $order->getBrand() ?? '',
                'model' => $order->getModel() ?? '',
                'caseSerial' => $order->getCaseSerialNumber() ?? '',
                'movementSerial' => $order->getMovementSerialNumber() ?? '',
                'movementCode' => $order->getMovementCode() ?? ($movement ? $movement->getCode() : ''),
                'movementName' => $movement ? $movement->getBrand() . ' ' . $movement->getCode() : '',
            ],
            'problem' => $order->getProblemDescription() ?? '',
            'intakeDate' => $order->getIntakeDate()?->format('Y-m-d H:i'),
            'deliveryDate' => $order->getActualDeliveryDate()?->format('Y-m-d H:i')
                ?? $order->getEstimatedDeliveryDate()?->format('Y-m-d'),
            'status' => $order->getStatus(),
            'inspection' => $inspection ? [
                'frequency' => $inspection->getFrequency(),
                'amplitude' => $inspection->getAmplitude(),
                'rate' => $inspection->getRate(),
                'beatError' => $inspection->getBeatError(),
                'powerReserve' => $inspection->getPowerReserve(),
                'waterResistance' => $inspection->getWaterResistance(),
                'notes' => $inspection->getNotes() ?? '',
            ] : null,
            'movementReference' => $movement ? [
                'standardFrequency' => $movement->getStandardFrequency(),
                'standardAmplitudeMin' => $movement->getStandardAmplitudeMin(),
                'standardAmplitudeMax' => $movement->getStandardAmplitudeMax(),
                'standardRateMin' => $movement->getStandardRateMin(),
                'standardRateMax' => $movement->getStandardRateMax(),
                'standardPowerReserveHours' => $movement->getStandardPowerReserveHours(),
                'commonFaults' => $movement->getCommonFaults(),
                'serviceSteps' => $movement->getServiceSteps(),
            ] : null,
            'images' => [
                'before' => $beforeImages,
                'during' => $duringImages,
                'after' => $afterImages,
            ],
            'partUsages' => $partUsages,
            'serviceItems' => $serviceItems,
            'progress' => $progress,
            'pricing' => [
                'labor' => (float)$order->getLaborPrice(),
                'parts' => (float)$order->getPartsPrice(),
                'total' => (float)$order->getTotalPrice(),
                'deposit' => (float)$order->getDeposit(),
                'balance' => (float)$order->getTotalPrice() - (float)$order->getDeposit(),
            ],
            'warranty' => $warrantyData,
            'pickupCode' => $pickupCode,
            'signature' => [
                'technician' => '',
                'customer' => '',
            ],
        ];
    }

    public function generatePdf(WorkOrder $order): string
    {
        $start = microtime(true);
        $reportData = $this->generateServiceReportData($order);

        $html = $this->twig->render('report/service_report.html.twig', [
            'report' => $reportData,
        ]);

        $filename = sprintf('%s-%s.pdf', $order->getOrderNumber(), date('YmdHis'));
        $outputPath = rtrim($this->pdfDirectory, '/') . '/' . $filename;

        $htmlFile = tempnam(sys_get_temp_dir(), 'report_');
        file_put_contents($htmlFile, $html);

        $cmd = sprintf(
            'wkhtmltopdf --page-size A4 --orientation Portrait --margin-top 15 --margin-bottom 15 --margin-left 12 --margin-right 12 %s %s 2>&1',
            escapeshellarg($htmlFile),
            escapeshellarg($outputPath)
        );
        @exec($cmd, $output, $returnCode);
        @unlink($htmlFile);

        if ($returnCode !== 0 || !file_exists($outputPath)) {
            $this->logger->warning('wkhtmltopdf failed, using mPDF fallback', ['output' => implode("\n", $output)]);
            $outputPath = $this->generatePdfFallback($html, $filename);
        }

        $elapsed = round(microtime(true) - $start, 3);
        $this->logger->info('Report PDF generated', [
            'order' => $order->getOrderNumber(),
            'path' => $outputPath,
            'seconds' => $elapsed,
            'size_kb' => filesize($outputPath) ? round(filesize($outputPath) / 1024, 1) : 0,
        ]);

        return $outputPath;
    }

    private function generatePdfFallback(string $html, string $filename): string
    {
        $outputPath = rtrim($this->pdfDirectory, '/') . '/' . $filename;

        $dom = new \DOMDocument();
        @$dom->loadHTML('<?xml encoding="UTF-8">' . $html);

        $mpdfClass = \Mpdf\Mpdf::class;
        if (class_exists($mpdfClass)) {
            $mpdf = new \Mpdf\Mpdf([
                'mode' => 'utf-8',
                'format' => 'A4',
                'margin_top' => 15,
                'margin_bottom' => 15,
                'margin_left' => 12,
                'margin_right' => 12,
            ]);
            $mpdf->SetDisplayMode('fullpage');
            $mpdf->WriteHTML($html);
            $mpdf->Output($outputPath, \Mpdf\Output\Destination::FILE);
        } else {
            $fh = fopen($outputPath, 'w');
            if ($fh) {
                fwrite($fh, $this->buildMinimalPdf($html));
                fclose($fh);
            }
        }

        return $outputPath;
    }

    private function buildMinimalPdf(string $html): string
    {
        $plain = strip_tags($html);
        $lines = array_filter(array_map('trim', explode("\n", $plain)));
        $content = implode("\n", $lines);

        $contentObj = "BT /F1 10 Tf 12 750 Td ";
        $y = 750;
        $parts = [];
        foreach ($lines as $line) {
            $line = addcslashes($line, "\\()\n\r");
            if (strlen($line) > 0) {
                $parts[] = "($line) Tj";
                $y -= 12;
                if ($y < 50) {
                    $contentObj .= implode(' 0 -12 Td ', $parts) . " 0 -12 Td ";
                    $parts = [];
                    $contentObj .= "ET\nBT /F1 10 Tf 12 750 Td ";
                    $y = 750;
                }
            }
        }
        $contentObj .= implode(' 0 -12 Td ', $parts) . " ET";

        $pdf = "%PDF-1.4\n";
        $offsets = [];

        $pdf .= "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
        $offsets[1] = 0;

        $pdf .= "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
        $offsets[2] = strlen($pdf);

        $pdf .= "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n";
        $offsets[3] = strlen($pdf);

        $stream = $contentObj;
        $pdf .= "4 0 obj\n<< /Length " . strlen($stream) . " >>\nstream\n" . $stream . "\nendstream\nendobj\n";
        $offsets[4] = strlen($pdf);

        $pdf .= "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n";
        $offsets[5] = strlen($pdf);

        $xrefPos = strlen($pdf);
        $pdf .= "xref\n0 6\n0000000000 65535 f \n";
        for ($i = 1; $i <= 5; $i++) {
            $pdf .= sprintf("%010d 00000 n \n", $offsets[$i]);
        }
        $pdf .= "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" . $xrefPos . "\n%%EOF";

        return $pdf;
    }

    public function sendReportByEmail(WorkOrder $order, ?string $emailOverride = null): bool
    {
        $customer = $order->getCustomer();
        $toEmail = $emailOverride ?? $customer?->getEmail();

        if (!$toEmail || !filter_var($toEmail, FILTER_VALIDATE_EMAIL)) {
            $this->logger->warning('Invalid email for report', [
                'order' => $order->getOrderNumber(),
                'to' => $toEmail,
            ]);
            return false;
        }

        try {
            $pdfPath = $this->generatePdf($order);
            $reportData = $this->generateServiceReportData($order);

            $email = (new Email())
                ->from(new Address($this->reportSenderEmail, $this->reportSenderName))
                ->to($toEmail)
                ->subject(sprintf(
                    '【服务报告】%s %s - %s',
                    $order->getBrand() ?? '腕表',
                    $order->getModel() ?? '',
                    $order->getOrderNumber()
                ))
                ->html($this->twig->render('email/service_report.html.twig', [
                    'report' => $reportData,
                    'customerName' => $customer?->getName() ?? '客户',
                    'order' => $order,
                ]));

            if (file_exists($pdfPath)) {
                $email->attachFromPath($pdfPath, sprintf('%s-服务报告.pdf', $order->getOrderNumber()), 'application/pdf');
            }

            $this->mailer->send($email);

            $order->addLogEntry('邮件发送', sprintf('服务报告邮件已发送至 %s', $toEmail));

            return true;
        } catch (\Throwable $e) {
            $this->logger->error('Failed to send report email', [
                'order' => $order->getOrderNumber(),
                'to' => $toEmail,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    private function generatePickupCode(WorkOrder $order): string
    {
        $seed = $order->getOrderNumber() . ($order->getCustomer()?->getPhone() ?? '');
        return strtoupper(substr(md5($seed), 0, 6));
    }
}
