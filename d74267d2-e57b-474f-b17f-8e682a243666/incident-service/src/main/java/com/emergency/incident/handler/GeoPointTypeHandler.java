package com.emergency.incident.handler;

import net.postgis.jdbc.PGgeometry;
import net.postgis.jdbc.geometry.Point;
import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;

import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

public class GeoPointTypeHandler extends BaseTypeHandler<com.emergency.common.dto.GeoPoint> {

    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, com.emergency.common.dto.GeoPoint parameter, JdbcType jdbcType) throws SQLException {
        Point point = new Point(parameter.getLng(), parameter.getLat());
        point.setSrid(4326);
        PGgeometry geometry = new PGgeometry(point);
        ps.setObject(i, geometry);
    }

    @Override
    public com.emergency.common.dto.GeoPoint getNullableResult(ResultSet rs, String columnName) throws SQLException {
        PGgeometry geometry = (PGgeometry) rs.getObject(columnName);
        if (geometry == null) {
            return null;
        }
        Point point = (Point) geometry.getGeometry();
        return com.emergency.common.dto.GeoPoint.builder()
                .lng(point.getX())
                .lat(point.getY())
                .build();
    }

    @Override
    public com.emergency.common.dto.GeoPoint getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        PGgeometry geometry = (PGgeometry) rs.getObject(columnIndex);
        if (geometry == null) {
            return null;
        }
        Point point = (Point) geometry.getGeometry();
        return com.emergency.common.dto.GeoPoint.builder()
                .lng(point.getX())
                .lat(point.getY())
                .build();
    }

    @Override
    public com.emergency.common.dto.GeoPoint getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        PGgeometry geometry = (PGgeometry) cs.getObject(columnIndex);
        if (geometry == null) {
            return null;
        }
        Point point = (Point) geometry.getGeometry();
        return com.emergency.common.dto.GeoPoint.builder()
                .lng(point.getX())
                .lat(point.getY())
                .build();
    }
}
