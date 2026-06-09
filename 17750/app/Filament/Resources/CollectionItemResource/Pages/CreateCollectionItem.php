<?php

namespace App\Filament\Resources\CollectionItemResource\Pages;

use App\Filament\Resources\CollectionItemResource;
use Filament\Actions;
use Filament\Resources\Pages\CreateRecord;

class CreateCollectionItem extends CreateRecord
{
    protected static string $resource = CollectionItemResource::class;

    protected function getRedirectUrl(): string
    {
        return $this->getResource()::getUrl('index');
    }
}
