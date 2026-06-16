package com.emergency.dispatch.handler;

import net.postgis.jdbc.PGgeometry;
import net.postgis.jdbc.geometry.Point;
import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;

import java.sql.*;

public class GeoPointTypeHandler extends BaseTypeHandler<com.emergency.common.dto.GeoPoint> {

    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, com.emergency.common.dto.GeoPoint parameter, JdbcType jdbcType) throws SQLException {
        Point point = new Point(parameter.getLng(), parameter.getLat());
        point.setSrid(4326);
        ps.setObject(i, new PGgeometry(point));
    }

    @Override
    public com.emergency.common.dto.GeoPoint getNullableResult(ResultSet rs, String columnName) throws SQLException {
        PGgeometry geometry = (PGgeometry) rs.getObject(columnName);
        return geometry != null ? convert((Point) geometry.getGeometry()) : null;
    }

    @Override
    public com.emergency.common.dto.GeoPoint getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        PGgeometry geometry = (PGgeometry) rs.getObject(columnIndex);
        return geometry != null ? convert((Point) geometry.getGeometry()) : null;
    }

    @Override
    public com.emergency.common.dto.GeoPoint getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        PGgeometry geometry = (PGgeometry) cs.getObject(columnIndex);
        return geometry != null ? convert((Point) geometry.getGeometry()) : null;
    }

    private com.emergency.common.dto.GeoPoint convert(Point point) {
        return com.emergency.common.dto.GeoPoint.builder()
                .lng(point.getX())
                .lat(point.getY())
                .build();
    }
}
