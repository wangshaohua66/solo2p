<?php

namespace App\Filament\Resources\CollectionItemResource\Pages;

use App\Filament\Resources\CollectionItemResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;

class EditCollectionItem extends EditRecord
{
    protected static string $resource = CollectionItemResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\DeleteAction::make(),
        ];
    }

    protected function getRedirectUrl(): string
    {
        return $this->getResource()::getUrl('index');
    }
}
