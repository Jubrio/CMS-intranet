<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationUtilisateur extends Model
{
    protected $table = 'notification_utilisateurs';

    public $timestamps = false;

    protected $fillable = ['notification_id', 'utilisateur_id', 'lu_at'];

    protected $casts = ['lu_at' => 'datetime'];

    public function notification(): BelongsTo
    {
        return $this->belongsTo(Notification::class);
    }
}
