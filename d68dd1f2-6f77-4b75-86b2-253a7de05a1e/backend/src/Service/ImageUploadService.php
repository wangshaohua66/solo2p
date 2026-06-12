<?php

namespace App\Service;

use App\Entity\WorkOrderImage;
use App\Repository\WorkOrderRepository;
use App\Repository\WorkOrderImageRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ImageUploadService
{
    private const int MAX_FILE_SIZE = 3 * 1024 * 1024;
    private const array ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    private const int MAX_WIDTH = 1920;
    private const int MAX_HEIGHT = 1920;

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly WorkOrderRepository $orderRepo,
        private readonly WorkOrderImageRepository $imageRepo,
        private readonly LoggerInterface $logger,
        private readonly string $uploadDirectory,
        private readonly string $publicBaseUrl = '/uploads/images',
    ) {
        $dirs = [
            $this->uploadDirectory,
            $this->uploadDirectory . '/intake',
            $this->uploadDirectory . '/during',
            $this->uploadDirectory . '/after',
        ];
        foreach ($dirs as $d) {
            if (!is_dir($d)) {
                @mkdir($d, 0755, true);
            }
        }
    }

    public function uploadWorkOrderImage(int $orderId, UploadedFile $file, string $type = 'intake'): array
    {
        if (!in_array($type, ['intake', 'during', 'after'], true)) {
            throw new BadRequestHttpException('无效的图片类型：' . $type);
        }

        $order = $this->orderRepo->find($orderId);
        if (!$order) {
            throw new NotFoundHttpException('工单不存在');
        }

        if ($file->getSize() > self::MAX_FILE_SIZE) {
            throw new BadRequestHttpException('图片大小不能超过 3MB');
        }

        $mime = $file->getMimeType();
        if (!in_array($mime, self::ALLOWED_TYPES, true)) {
            throw new BadRequestHttpException('不支持的图片格式：' . $mime);
        }

        $originalName = $file->getClientOriginalName();
        $start = microtime(true);
        $processed = $this->processImage($file->getPathname(), $mime, $type);
        $elapsed = round((microtime(true) - $start) * 1000, 2);

        $image = new WorkOrderImage();
        $image->setWorkOrder($order);
        $image->setFileName($processed['filename']);
        $image->setFilePath($processed['relativePath']);
        $image->setFileSize($processed['size']);
        $image->setMimeType('image/webp');
        $image->setType($type);
        $image->setCaption($originalName);
        $image->setOriginalFileName($originalName);
        $image->setWidth($processed['width']);
        $image->setHeight($processed['height']);

        $this->em->persist($image);
        $order->addImage($image);

        $order->addLogEntry(
            '上传图片',
            sprintf('类型：%s | 原始：%s | 处理后：%.1fKB（%dx%d）| 耗时：%dms',
                $type,
                $originalName,
                $processed['size'] / 1024,
                $processed['width'],
                $processed['height'],
                $elapsed
            )
        );

        $this->em->flush();

        return [
            'id' => $image->getId(),
            'type' => $type,
            'url' => $this->publicBaseUrl . $processed['relativePath'],
            'thumbnail' => $this->publicBaseUrl . $processed['relativePath'],
            'caption' => $originalName,
            'width' => $processed['width'],
            'height' => $processed['height'],
            'size' => $processed['size'],
            'processingMs' => $elapsed,
        ];
    }

    public function deleteImage(int $imageId): void
    {
        $image = $this->imageRepo->find($imageId);
        if (!$image) {
            throw new NotFoundHttpException('图片不存在');
        }

        $fullPath = rtrim($this->uploadDirectory, '/') . $image->getFilePath();
        if (file_exists($fullPath)) {
            @unlink($fullPath);
        }

        $order = $image->getWorkOrder();
        if ($order) {
            $order->removeImage($image);
            $order->addLogEntry(
                '删除图片',
                sprintf('删除图片：%s（%s）', $image->getOriginalFileName() ?? $image->getFileName(), $image->getType())
            );
        }

        $this->em->remove($image);
        $this->em->flush();
    }

    public function processImage(string $sourcePath, string $sourceMime, string $subDir): array
    {
        $imageInfo = $this->createImage($sourcePath, $sourceMime);
        if (!$imageInfo) {
            throw new BadRequestHttpException('无法解析图片内容');
        }

        [$gd, $origW, $origH] = $imageInfo;

        $newW = $origW;
        $newH = $origH;
        if ($origW > self::MAX_WIDTH || $origH > self::MAX_HEIGHT) {
            $ratio = min(self::MAX_WIDTH / $origW, self::MAX_HEIGHT / $origH);
            $newW = (int)round($origW * $ratio);
            $newH = (int)round($origH * $ratio);
        }

        if ($newW !== $origW || $newH !== $origH) {
            $resized = imagecreatetruecolor($newW, $newH);
            imagealphablending($resized, false);
            imagesavealpha($resized, true);
            imagecopyresampled($resized, $gd, 0, 0, 0, 0, $newW, $newH, $origW, $origH);
            imagedestroy($gd);
            $gd = $resized;
        }

        $filename = sprintf('%s_%s.webp', date('YmdHis'), substr(bin2hex(random_bytes(6)), 0, 12));
        $relativePath = sprintf('/%s/%s', $subDir, $filename);
        $outputPath = rtrim($this->uploadDirectory, '/') . $relativePath;

        $quality = 85;
        imagewebp($gd, $outputPath, $quality);

        $attempts = 0;
        while (file_exists($outputPath) && filesize($outputPath) > self::MAX_FILE_SIZE && $attempts < 3 && $quality > 55) {
            $quality -= 15;
            imagewebp($gd, $outputPath, $quality);
            $attempts++;
        }

        $finalSize = filesize($outputPath);
        imagedestroy($gd);

        return [
            'filename' => $filename,
            'relativePath' => $relativePath,
            'size' => $finalSize,
            'width' => $newW,
            'height' => $newH,
        ];
    }

    private function createImage(string $path, string $mime): ?array
    {
        try {
            $info = @getimagesize($path);
            if (!$info) {
                return null;
            }
            [$width, $height, $type] = $info;
            switch ($type) {
                case IMAGETYPE_JPEG:
                    $gd = @imagecreatefromjpeg($path);
                    break;
                case IMAGETYPE_PNG:
                    $gd = @imagecreatefrompng($path);
                    break;
                case IMAGETYPE_GIF:
                    $gd = @imagecreatefromgif($path);
                    break;
                case IMAGETYPE_WEBP:
                    $gd = @imagecreatefromwebp($path);
                    break;
                default:
                    return null;
            }
            if (!$gd) {
                return null;
            }
            return [$gd, $width, $height];
        } catch (\Throwable $e) {
            return null;
        }
    }
}
