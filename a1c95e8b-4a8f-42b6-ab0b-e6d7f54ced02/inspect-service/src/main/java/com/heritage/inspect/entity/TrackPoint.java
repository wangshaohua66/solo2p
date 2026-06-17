package com.heritage.inspect.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "track_points")
@CompoundIndexes({
    @CompoundIndex(name = "task_time_idx", def = "{'taskId': 1, 'time': 1}")
})
public class TrackPoint {
    @Id
    private String id;
    @Indexed
    private String taskId;
    @Indexed
    private String inspectorId;
    private Double latitude;
    private Double longitude;
    private Double altitude;
    private Double accuracy;
    private Double speed;
    private LocalDateTime time;
}
